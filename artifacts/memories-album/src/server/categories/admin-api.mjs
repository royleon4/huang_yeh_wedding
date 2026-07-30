import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";
import {
  normalizeYoutubeVideoId,
  youtubeWatchUrl,
} from "../processes/youtube.mjs";

function categoryPayload(category) {
  return {
    id: category.id,
    labelZh: category.labelZh,
    labelEn: category.labelEn,
    displayOrder: category.displayOrder,
    youtubeUrl: youtubeWatchUrl(category.youtubeVideoId),
    youtubeVideoId: category.youtubeVideoId ?? null,
    youtubeAutoplay: Boolean(category.youtubeAutoplay),
    syncState: category.syncState,
    lastSyncedAt: category.lastSyncedAt,
  };
}

function normalizeLabel(value, { required = false } = {}) {
  const label = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if ((required && !label) || Array.from(label).length > 80) {
    const error = new Error(
      "Category name is required and must be 80 characters or fewer",
    );
    error.status = 422;
    error.code = "INVALID_CATEGORY";
    throw error;
  }
  return label;
}

function videoSettings(body, existing = null) {
  const youtubeVideoId = Object.hasOwn(body, "youtubeUrl")
    ? normalizeYoutubeVideoId(body.youtubeUrl)
    : (existing?.youtubeVideoId ?? null);
  const youtubeAutoplay = youtubeVideoId
    ? Object.hasOwn(body, "youtubeAutoplay")
      ? Boolean(body.youtubeAutoplay)
      : Boolean(existing?.youtubeAutoplay)
    : false;
  return { youtubeVideoId, youtubeAutoplay };
}

async function saveVideoSettings(repository, category, settings) {
  if (typeof repository.updateProcessVideo === "function") {
    return repository.updateProcessVideo(category.id, settings);
  }
  return { ...category, ...settings };
}

export function createAdminCategoryApi({
  repository,
  synchronizer,
  adminToken,
}) {
  if (!repository || !synchronizer) {
    throw new Error("Category repository and synchronizer are required");
  }

  return async function handleAdminCategoryApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const collectionPath = url.pathname === "/admin/api/categories";
    const orderPath = url.pathname === "/admin/api/categories/order";
    const itemMatch = !orderPath
      ? url.pathname.match(/^\/admin\/api\/categories\/([^/]+)$/)
      : null;
    if (!collectionPath && !orderPath && !itemMatch) return false;

    try {
      if (
        !requireAdmin(request, response, adminToken, {
          mutate: request.method !== "GET",
        })
      ) {
        return true;
      }

      if (request.method === "GET" && collectionPath) {
        const categories = await repository.listProcesses();
        sendAdminJson(response, 200, {
          categories: categories.map(categoryPayload),
        });
        return true;
      }

      if (request.method === "POST" && collectionPath) {
        const body = await readAdminJson(request);
        let category = await synchronizer.createProcess({
          labelZh: normalizeLabel(body.labelZh, { required: true }),
          labelEn: normalizeLabel(body.labelEn),
        });
        category = await saveVideoSettings(
          repository,
          category,
          videoSettings(body),
        );
        sendAdminJson(response, 201, {
          category: categoryPayload(category),
        });
        return true;
      }

      if (request.method === "PATCH" && itemMatch) {
        const id = decodeURIComponent(itemMatch[1]);
        const categories = await repository.listProcesses();
        const existing = categories.find((category) => category.id === id);
        if (!existing) {
          sendAdminJson(response, 404, {
            error: "Category not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const body = await readAdminJson(request);
        const labelZh = normalizeLabel(body.labelZh ?? existing.labelZh, {
          required: true,
        });
        const labelEn = normalizeLabel(body.labelEn ?? existing.labelEn);
        let category = existing;
        if (labelZh !== existing.labelZh || labelEn !== existing.labelEn) {
          category = await synchronizer.renameProcess(
            existing,
            labelZh,
            labelEn,
          );
        }
        category = await saveVideoSettings(
          repository,
          category,
          videoSettings(body, category),
        );
        sendAdminJson(response, 200, {
          category: categoryPayload(category),
        });
        return true;
      }

      if (request.method === "PUT" && orderPath) {
        const body = await readAdminJson(request);
        if (
          !Array.isArray(body.categoryIds) ||
          body.categoryIds.length === 0 ||
          new Set(body.categoryIds).size !== body.categoryIds.length
        ) {
          sendAdminJson(response, 422, {
            error: "categoryIds must be a non-empty array without duplicates",
            code: "INVALID_CATEGORY_ORDER",
          });
          return true;
        }
        const categories = await synchronizer.reorderProcesses(
          body.categoryIds.map(String),
        );
        sendAdminJson(response, 200, {
          categories: categories.map(categoryPayload),
        });
        return true;
      }

      sendAdminJson(response, 405, {
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      });
      return true;
    } catch (error) {
      if (error?.status && error?.code) {
        sendAdminJson(response, error.status, {
          error: error.message,
          code: error.code,
        });
        return true;
      }
      throw error;
    }
  };
}
