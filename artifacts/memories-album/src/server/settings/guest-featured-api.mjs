const ENABLED_STORAGE_KEY = "guest_random_featured_photos_enabled";
const MIN_STORAGE_KEY = "guest_random_featured_photos_min";
const MAX_STORAGE_KEY = "guest_random_featured_photos_max";
const DEFAULT_MINIMUM = 1;
const DEFAULT_MAXIMUM = 3;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 4 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large");
      error.status = 413;
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

function normalizeRange(minimum, maximum) {
  const min = Number(minimum);
  const max = Number(maximum);
  if (
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    max >= min
  ) {
    return { minimum: min, maximum: max };
  }
  return { minimum: DEFAULT_MINIMUM, maximum: DEFAULT_MAXIMUM };
}

async function readSettings(pool) {
  const result = await pool.query(
    `SELECT key, value
     FROM memories_app_settings
     WHERE key = ANY($1::text[])`,
    [[ENABLED_STORAGE_KEY, MIN_STORAGE_KEY, MAX_STORAGE_KEY]],
  );
  const values = new Map(result.rows.map((row) => [row.key, row.value]));
  const range = normalizeRange(
    values.get(MIN_STORAGE_KEY),
    values.get(MAX_STORAGE_KEY),
  );
  return {
    guestRandomFeaturedPhotosEnabled:
      values.get(ENABLED_STORAGE_KEY) === true,
    guestRandomFeaturedPhotosMin: range.minimum,
    guestRandomFeaturedPhotosMax: range.maximum,
  };
}

async function writeSettings(pool, settings) {
  const entries = [
    [ENABLED_STORAGE_KEY, settings.guestRandomFeaturedPhotosEnabled === true],
    [MIN_STORAGE_KEY, settings.guestRandomFeaturedPhotosMin],
    [MAX_STORAGE_KEY, settings.guestRandomFeaturedPhotosMax],
  ];
  await pool.query("BEGIN");
  try {
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO memories_app_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = now()`,
        [key, JSON.stringify(value)],
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
  return settings;
}

export function createGuestFeaturedSettingsApis({ pool }) {
  if (!pool?.query) throw new Error("A PostgreSQL pool is required");

  const publicApi = async (
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) => {
    if (url.pathname !== "/Memories/api/settings/guest-featured") return false;
    if (request.method !== "GET") return false;
    json(response, 200, await readSettings(pool));
    return true;
  };

  const adminApi = async (
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) => {
    if (url.pathname !== "/admin/api/settings/guest-featured") return false;

    if (request.method === "GET") {
      json(response, 200, await readSettings(pool));
      return true;
    }

    if (request.method !== "PATCH") return false;

    try {
      const body = await readJson(request);
      if (typeof body.guestRandomFeaturedPhotosEnabled !== "boolean") {
        json(response, 422, {
          error: "guestRandomFeaturedPhotosEnabled must be a boolean",
          code: "INVALID_SETTING",
        });
        return true;
      }
      const minimum = Number(body.guestRandomFeaturedPhotosMin);
      const maximum = Number(body.guestRandomFeaturedPhotosMax);
      if (
        !Number.isInteger(minimum) ||
        !Number.isInteger(maximum) ||
        minimum < 0 ||
        maximum < minimum
      ) {
        json(response, 422, {
          error: "Featured-photo range must contain non-negative integers and maximum must be greater than or equal to minimum",
          code: "INVALID_SETTING",
        });
        return true;
      }
      json(
        response,
        200,
        await writeSettings(pool, {
          guestRandomFeaturedPhotosEnabled:
            body.guestRandomFeaturedPhotosEnabled,
          guestRandomFeaturedPhotosMin: minimum,
          guestRandomFeaturedPhotosMax: maximum,
        }),
      );
    } catch (error) {
      json(response, error.status ?? 400, {
        error: error.message || "Invalid guest featured-photo setting",
        code: error.code || "INVALID_SETTINGS_REQUEST",
      });
    }
    return true;
  };

  return { publicApi, adminApi };
}
