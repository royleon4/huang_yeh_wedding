const STORAGE_KEY = "guest_random_featured_photos_enabled";

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

async function readEnabled(pool) {
  const result = await pool.query(
    `SELECT value
     FROM memories_app_settings
     WHERE key = $1
     LIMIT 1`,
    [STORAGE_KEY],
  );
  return result.rows[0]?.value === true;
}

async function writeEnabled(pool, enabled) {
  await pool.query(
    `INSERT INTO memories_app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = now()`,
    [STORAGE_KEY, JSON.stringify(enabled === true)],
  );
  return enabled === true;
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
    json(response, 200, {
      guestRandomFeaturedPhotosEnabled: await readEnabled(pool),
    });
    return true;
  };

  const adminApi = async (
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) => {
    if (url.pathname !== "/admin/api/settings/guest-featured") return false;

    if (request.method === "GET") {
      json(response, 200, {
        guestRandomFeaturedPhotosEnabled: await readEnabled(pool),
      });
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
      json(response, 200, {
        guestRandomFeaturedPhotosEnabled: await writeEnabled(
          pool,
          body.guestRandomFeaturedPhotosEnabled,
        ),
      });
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
