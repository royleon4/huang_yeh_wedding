import { randomUUID } from "node:crypto";
import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";
import { parseMessageImport } from "./import-format.mjs";

function apiError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizedText(
  value,
  maximum,
  field,
  { compatibilityNormalize = true } = {},
) {
  const raw = String(value ?? "");
  const normalized = (compatibilityNormalize ? raw.normalize("NFKC") : raw).trim();
  const length = Array.from(normalized).length;
  if (!normalized || length > maximum) {
    throw apiError(
      `${field} is required and must be ${maximum} characters or fewer`,
      422,
      "INVALID_MESSAGE",
    );
  }
  return normalized;
}

function messagePayload(message) {
  return {
    id: message.id,
    albumId: message.albumId,
    visitorName: message.visitorName,
    body: message.body,
    messageAt: message.messageAt,
  };
}

function adminMessagePayload(message) {
  return {
    ...messagePayload(message),
    visibility: message.visibility,
    source: message.source,
  };
}

async function singletonMessageAlbum(albumRepository, { publicOnly = false } = {}) {
  const albums = publicOnly
    ? await albumRepository.listPublicAlbums()
    : await albumRepository.listAdminAlbums();
  const album = albums.find((candidate) => candidate.albumType === "message");
  if (!album) {
    throw apiError("The message album is unavailable", 503, "MESSAGE_ALBUM_UNAVAILABLE");
  }
  return album;
}

export function createMessageApi({ repository, albumRepository, createId = randomUUID }) {
  if (!repository || !albumRepository) {
    throw new Error("Message and album repositories are required");
  }

  return async function handleMessageApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== "/Memories/api/settings/messages") return false;

    try {
      const album = await singletonMessageAlbum(albumRepository, { publicOnly: true });
      if (request.method === "GET") {
        const messages = await repository.listPublicMessages({
          albumId: album.id,
          limit: url.searchParams.get("limit") ?? 200,
        });
        sendAdminJson(response, 200, {
          albumId: album.id,
          messages: messages.map(messagePayload),
        });
        return true;
      }

      if (request.method === "POST") {
        const body = await readAdminJson(request, 16 * 1024);
        const message = await repository.createMessage({
          id: createId(),
          albumId: album.id,
          visitorName: normalizedText(body.visitorName, 80, "visitorName"),
          body: normalizedText(body.message, 1000, "message", {
            compatibilityNormalize: false,
          }),
          messageAt: new Date().toISOString(),
          visibility: "public",
          source: "guest",
        });
        sendAdminJson(response, 201, { message: messagePayload(message) });
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

export function createAdminMessageApi({
  repository,
  albumRepository,
  adminToken,
  createId = randomUUID,
}) {
  if (!repository || !albumRepository) {
    throw new Error("Message and album repositories are required");
  }

  return async function handleAdminMessageApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const collectionPath = url.pathname === "/admin/api/settings/messages";
    const importPath = url.pathname === "/admin/api/settings/messages/import";
    const itemMatch = url.pathname.match(
      /^\/admin\/api\/settings\/messages\/([^/]+)$/,
    );
    if (!collectionPath && !importPath && !itemMatch) return false;
    if (!requireAdmin(request, response, adminToken, { mutate: request.method !== "GET" })) {
      return true;
    }

    try {
      const album = await singletonMessageAlbum(albumRepository);
      if (request.method === "GET" && collectionPath) {
        const messages = await repository.listAdminMessages({ albumId: album.id });
        sendAdminJson(response, 200, {
          albumId: album.id,
          format: {
            encoding: "UTF-8",
            headers: ["name", "message", "datetime"],
            acceptedHeaders: [
              "name,message,datetime",
              "姓名,留言,日期時間",
              "name,message,date",
              "姓名,留言,日期",
            ],
            dateTimeFormats: [
              "YYYY-MM-DD HH:mm",
              "YYYY-MM-DDTHH:mm",
              "ISO 8601 with timezone",
            ],
            timeZonePolicy:
              "Datetime values without a timezone use the administrator browser offset",
            maximumRows: 500,
          },
          messages: messages.map(adminMessagePayload),
        });
        return true;
      }

      if (request.method === "DELETE" && collectionPath) {
        const deleted = await repository.deleteAllMessages({ albumId: album.id });
        sendAdminJson(response, 200, { deleted });
        return true;
      }

      if (request.method === "POST" && importPath) {
        const body = await readAdminJson(request, 1024 * 1024);
        const parsed = parseMessageImport(body.content, {
          maximumRows: 500,
          timeZoneOffsetMinutes: body.timeZoneOffsetMinutes,
        });
        const messages = await repository.importMessages(
          parsed.map((entry) => ({
            id: createId(),
            albumId: album.id,
            ...entry,
          })),
        );
        sendAdminJson(response, 201, {
          imported: messages.length,
          messages: messages.map(adminMessagePayload),
        });
        return true;
      }

      if (itemMatch && request.method === "PATCH") {
        const body = await readAdminJson(request, 4 * 1024);
        if (!["public", "hidden"].includes(body.visibility)) {
          throw apiError(
            "visibility must be public or hidden",
            422,
            "INVALID_MESSAGE_VISIBILITY",
          );
        }
        const message = await repository.updateVisibility({
          id: decodeURIComponent(itemMatch[1]),
          albumId: album.id,
          visibility: body.visibility,
        });
        if (!message) {
          throw apiError("Message not found", 404, "MESSAGE_NOT_FOUND");
        }
        sendAdminJson(response, 200, { message: adminMessagePayload(message) });
        return true;
      }

      if (itemMatch && request.method === "DELETE") {
        const id = decodeURIComponent(itemMatch[1]);
        const deletedId = await repository.deleteMessage({ id, albumId: album.id });
        if (!deletedId) {
          throw apiError("Message not found", 404, "MESSAGE_NOT_FOUND");
        }
        sendAdminJson(response, 200, { deleted: true, id: deletedId });
        return true;
      }

      sendAdminJson(response, 405, {
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      });
      return true;
    } catch (error) {
      if (error?.code === "INVALID_MESSAGE_IMPORT") {
        sendAdminJson(response, 422, { error: error.message, code: error.code });
        return true;
      }
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
