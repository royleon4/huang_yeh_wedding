import {
  PROCESS_WHEEL_VISIBLE_COUNTS,
  isValidProcessWheelLoopAlbumIds,
  normalizeProcessSelectorSettings,
} from "../../process-selector-settings.mjs";
import { PostgresSettingsRepository } from "./repository.mjs";

const ENABLED_STORAGE_KEY = "guest_random_featured_photos_enabled";
const MIN_STORAGE_KEY = "guest_random_featured_photos_min";
const MAX_STORAGE_KEY = "guest_random_featured_photos_max";
const LABEL_AUTO_SCROLL_STORAGE_KEY = "process_label_auto_scroll_enabled";
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

async function readLabelAutoScrollEnabled(pool) {
  const result = await pool.query(
    `SELECT value
     FROM memories_app_settings
     WHERE key = $1
     LIMIT 1`,
    [LABEL_AUTO_SCROLL_STORAGE_KEY],
  );
  return result.rows[0]?.value !== false;
}

async function writeLabelAutoScrollEnabled(pool, enabled) {
  const value = enabled === true;
  await pool.query(
    `INSERT INTO memories_app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = now()`,
    [LABEL_AUTO_SCROLL_STORAGE_KEY, JSON.stringify(value)],
  );
  return { processLabelAutoScrollEnabled: value };
}

async function readCompletePublicSettings(pool, settingsRepository) {
  const [settings, processLabelAutoScrollEnabled] = await Promise.all([
    settingsRepository.getPublicSettings(),
    readLabelAutoScrollEnabled(pool),
  ]);
  return { ...settings, processLabelAutoScrollEnabled };
}

export function createGuestFeaturedSettingsApis({ pool }) {
  if (!pool?.query) throw new Error("A PostgreSQL pool is required");
  const settingsRepository = new PostgresSettingsRepository(pool);

  const publicApi = async (
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) => {
    if (
      url.pathname === "/Memories/api/settings" &&
      request.method === "GET"
    ) {
      json(
        response,
        200,
        await readCompletePublicSettings(pool, settingsRepository),
      );
      return true;
    }

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
    if (url.pathname === "/admin/api/settings" && request.method === "GET") {
      json(
        response,
        200,
        await readCompletePublicSettings(pool, settingsRepository),
      );
      return true;
    }

    if (url.pathname === "/admin/api/settings/process-selector") {
      if (request.method === "GET") {
        json(
          response,
          200,
          normalizeProcessSelectorSettings(
            await readCompletePublicSettings(pool, settingsRepository),
          ),
        );
        return true;
      }

      if (request.method !== "PATCH") return false;

      try {
        const body = await readJson(request);
        if (
          typeof body.processWheelEnabled !== "boolean" ||
          typeof body.processLabelAutoScrollEnabled !== "boolean"
        ) {
          json(response, 422, {
            error: "Process selector boolean settings must be boolean values",
            code: "INVALID_SETTING",
          });
          return true;
        }
        const visibleCount = Number(body.processWheelVisibleCount);
        if (!PROCESS_WHEEL_VISIBLE_COUNTS.includes(visibleCount)) {
          json(response, 422, {
            error: "processWheelVisibleCount must be an integer from 3 to 8",
            code: "INVALID_SETTING",
          });
          return true;
        }
        if (
          !isValidProcessWheelLoopAlbumIds(body.processWheelLoopAlbumIds)
        ) {
          json(response, 422, {
            error: "processWheelLoopAlbumIds contains an unsupported or duplicate album ID",
            code: "INVALID_SETTING",
          });
          return true;
        }

        const updates = {};
        Object.assign(
          updates,
          await settingsRepository.setProcessWheelEnabled(
            body.processWheelEnabled,
          ),
        );
        Object.assign(
          updates,
          await settingsRepository.setProcessWheelVisibleCount(visibleCount),
        );
        Object.assign(
          updates,
          await settingsRepository.setProcessWheelLoopAlbumIds(
            body.processWheelLoopAlbumIds,
          ),
        );
        Object.assign(
          updates,
          await writeLabelAutoScrollEnabled(
            pool,
            body.processLabelAutoScrollEnabled,
          ),
        );
        json(response, 200, normalizeProcessSelectorSettings(updates));
      } catch (error) {
        json(response, error.status ?? 400, {
          error: error.message || "Invalid process selector setting",
          code: error.code || "INVALID_SETTINGS_REQUEST",
        });
      }
      return true;
    }

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
