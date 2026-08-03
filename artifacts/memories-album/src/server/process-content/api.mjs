import Busboy from "busboy";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { recoverUtf8Filename } from "../../filename-encoding.mjs";
import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";
import { normalizeYoutubeVideoId } from "../processes/youtube.mjs";
import { ALL_PROCESS_KEY } from "./repository.mjs";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_HTML_CHARACTERS = 200_000;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);
const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "zip",
]);

function publicJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function errorWith(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function boundedText(value, maxCharacters, { required = false } = {}) {
  const text = String(value ?? "").normalize("NFKC").trim();
  if ((required && !text) || Array.from(text).length > maxCharacters) {
    throw errorWith(422, "INVALID_PROCESS_CONTENT", "Invalid text value");
  }
  return text;
}

function sanitizeStoredHtml(value) {
  const html = String(value ?? "").trim();
  if (Array.from(html).length > MAX_HTML_CHARACTERS) {
    throw errorWith(413, "PROCESS_CONTENT_TOO_LARGE", "Rich text is too large");
  }
  return html
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\2/gi, ' $1="#"');
}

function boundedPadding(value, fallback = 12) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 0 || number > 96) {
    throw errorWith(
      422,
      "INVALID_DIVIDER_PADDING",
      "Divider padding must be an integer from 0 to 96",
    );
  }
  return number;
}

function safeFilename(filename) {
  const value = String(recoverUtf8Filename(filename) || "attachment")
    .normalize("NFKC")
    .replace(/[\\/\0\r\n]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return value || "attachment";
}

function extension(filename) {
  return safeFilename(filename).split(".").at(-1)?.toLowerCase() ?? "";
}

function attachmentPayload(attachment) {
  const encoded = encodeURIComponent(attachment.id);
  return {
    id: attachment.id,
    processKey: attachment.processKey,
    name: recoverUtf8Filename(attachment.originalFilename),
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    isImage: attachment.isImage,
    createdAt: attachment.createdAt,
    url: `/Memories/api/process-attachments/${encoded}`,
    downloadUrl: `/Memories/api/process-attachments/${encoded}?download=1`,
  };
}

function parseAttachmentMultipart(request) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: request.headers,
        defParamCharset: "utf8",
        limits: { files: 1, fields: 0, fileSize: MAX_ATTACHMENT_BYTES },
      });
    } catch {
      reject(errorWith(415, "INVALID_MULTIPART", "Expected a multipart upload"));
      return;
    }

    let record = null;
    let problem = null;
    parser.on("file", (fieldName, stream, info) => {
      if (fieldName !== "attachment" || record) {
        problem = errorWith(400, "INVALID_FILE_COUNT", "Exactly one attachment is required");
        stream.resume();
        return;
      }
      const chunks = [];
      let truncated = false;
      stream.on("limit", () => {
        truncated = true;
      });
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        const bytes = Buffer.concat(chunks);
        record = {
          filename: safeFilename(info.filename),
          mimeType: String(info.mimeType || "application/octet-stream").toLowerCase(),
          bytes,
          truncated,
        };
      });
    });
    parser.on("error", () => {
      reject(errorWith(400, "INVALID_MULTIPART", "Attachment upload could not be read"));
    });
    parser.on("finish", () => {
      if (problem) return reject(problem);
      if (!record) return reject(errorWith(400, "ATTACHMENT_REQUIRED", "An attachment is required"));
      if (record.truncated) {
        return reject(errorWith(413, "ATTACHMENT_TOO_LARGE", "Attachment exceeds 25 MB"));
      }
      if (
        !ALLOWED_MIME_TYPES.has(record.mimeType) &&
        !ALLOWED_EXTENSIONS.has(extension(record.filename))
      ) {
        return reject(
          errorWith(
            415,
            "UNSUPPORTED_ATTACHMENT",
            "This attachment type is not supported",
          ),
        );
      }
      resolve(record);
    });
    request.pipe(parser);
  });
}

async function ensureProcessKey(processKey, processRepository) {
  if (processKey === ALL_PROCESS_KEY) return;
  const process = await processRepository.findProcessById(processKey);
  if (!process?.isActive) {
    throw errorWith(404, "PROCESS_NOT_FOUND", "Process category was not found");
  }
}

function normalizeContentPatch(processKey, body) {
  const patch = {
    contentHtmlZh: sanitizeStoredHtml(body.contentHtmlZh),
    contentHtmlEn: sanitizeStoredHtml(body.contentHtmlEn),
    dividerPaddingTop: boundedPadding(body.dividerPaddingTop),
    dividerPaddingBottom: boundedPadding(body.dividerPaddingBottom),
  };
  if (processKey === ALL_PROCESS_KEY) {
    const videoInput = String(body.youtubeUrl ?? body.youtubeVideoId ?? "").trim();
    patch.labelZh = boundedText(body.labelZh, 80, { required: true });
    patch.labelEn = boundedText(body.labelEn || body.labelZh, 80, { required: true });
    patch.youtubeVideoId = videoInput ? normalizeYoutubeVideoId(videoInput) : null;
    patch.youtubeAutoplay = Boolean(body.youtubeAutoplay && patch.youtubeVideoId);
    patch.showAllPhotos = body.showAllPhotos !== false;
  }
  return patch;
}

function contentPayload(content, attachments = []) {
  return {
    ...content,
    attachments: attachments.map(attachmentPayload),
  };
}

function sendFile(response, file, attachment, forceDownload) {
  const disposition = forceDownload || !attachment.isImage ? "attachment" : "inline";
  const encodedName = encodeURIComponent(recoverUtf8Filename(attachment.originalFilename));
  response.writeHead(200, {
    "Content-Type": attachment.mimeType || file.contentType || "application/octet-stream",
    ...(file.contentLength ? { "Content-Length": file.contentLength } : {}),
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  });
  if (Buffer.isBuffer(file.body) || file.body instanceof Uint8Array) {
    response.end(file.body);
  } else if (typeof file.body?.pipe === "function") {
    file.body.pipe(response);
  } else if (file.body?.getReader) {
    Readable.fromWeb(file.body).pipe(response);
  } else {
    response.destroy(errorWith(500, "INVALID_DRIVE_BODY", "Unsupported attachment body"));
  }
}

export function createProcessContentApi({ repository, drive }) {
  if (!repository || !drive) {
    throw new Error("Process content repository and Drive are required");
  }
  return async function handleProcessContentApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const match = url.pathname.match(/^\/Memories\/api\/process-attachments\/([^/]+)$/);
    if (request.method !== "GET" || !match) return false;
    const attachment = await repository.findAttachment(decodeURIComponent(match[1]));
    if (!attachment) {
      publicJson(response, 404, { error: "Attachment not found", code: "NOT_FOUND" });
      return true;
    }
    try {
      const file = await drive.download(attachment.driveFileId);
      sendFile(response, file, attachment, url.searchParams.get("download") === "1");
    } catch (error) {
      if (Number(error?.status) === 404) {
        publicJson(response, 404, { error: "Attachment not found", code: "NOT_FOUND" });
      } else {
        throw error;
      }
    }
    return true;
  };
}

export function createAdminProcessContentApi({
  repository,
  processRepository,
  drive,
  adminToken,
  createId = randomUUID,
}) {
  if (!repository || !processRepository || !drive) {
    throw new Error("Process content, process, and Drive services are required");
  }

  return async function handleAdminProcessContentApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const itemMatch = url.pathname.match(/^\/admin\/api\/process-content\/([^/]+)$/);
    const attachmentCollectionMatch = url.pathname.match(
      /^\/admin\/api\/process-content\/([^/]+)\/attachments$/,
    );
    const attachmentItemMatch = url.pathname.match(
      /^\/admin\/api\/process-content\/attachments\/([^/]+)$/,
    );
    if (!itemMatch && !attachmentCollectionMatch && !attachmentItemMatch) return false;

    try {
      if (!requireAdmin(request, response, adminToken, { mutate: request.method !== "GET" })) {
        return true;
      }

      if (itemMatch && request.method === "GET") {
        const processKey = decodeURIComponent(itemMatch[1]);
        await ensureProcessKey(processKey, processRepository);
        const [content, attachments] = await Promise.all([
          repository.findContent(processKey),
          repository.listAttachments(processKey),
        ]);
        sendAdminJson(response, 200, { content: contentPayload(content, attachments) });
        return true;
      }

      if (itemMatch && request.method === "PATCH") {
        const processKey = decodeURIComponent(itemMatch[1]);
        await ensureProcessKey(processKey, processRepository);
        const body = await readAdminJson(request, { maxBytes: 500_000 });
        const content = await repository.updateContent(
          processKey,
          normalizeContentPatch(processKey, body),
        );
        const attachments = await repository.listAttachments(processKey);
        sendAdminJson(response, 200, { content: contentPayload(content, attachments) });
        return true;
      }

      if (attachmentCollectionMatch && request.method === "POST") {
        const processKey = decodeURIComponent(attachmentCollectionMatch[1]);
        await ensureProcessKey(processKey, processRepository);
        const file = await parseAttachmentMultipart(request);
        const id = createId();
        const storedName = `process-content-${id}-${safeFilename(file.filename)}`;
        const uploaded = await drive.uploadAttachment({
          bytes: file.bytes,
          filename: storedName,
          contentType: file.mimeType,
          parentId: drive.unclassifiedFolderId ?? drive.originalFolderId,
          appProperties: { processKey, attachmentId: id, uploader: "admin" },
        });
        try {
          const attachment = await repository.createAttachment({
            id,
            processKey,
            driveFileId: uploaded.fileId,
            originalFilename: file.filename,
            mimeType: file.mimeType,
            byteSize: file.bytes.length,
            isImage: file.mimeType.startsWith("image/"),
          });
          sendAdminJson(response, 201, { attachment: attachmentPayload(attachment) });
        } catch (error) {
          if (!uploaded.reused) await drive.delete(uploaded.fileId).catch(() => {});
          throw error;
        }
        return true;
      }

      if (attachmentItemMatch && request.method === "DELETE") {
        const id = decodeURIComponent(attachmentItemMatch[1]);
        const attachment = await repository.findAttachment(id);
        if (!attachment) {
          sendAdminJson(response, 404, { error: "Attachment not found", code: "NOT_FOUND" });
          return true;
        }
        await drive.delete(attachment.driveFileId);
        await repository.deleteAttachment(id);
        sendAdminJson(response, 200, { deleted: true, id });
        return true;
      }

      sendAdminJson(response, 405, { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
      return true;
    } catch (error) {
      if (response.headersSent) throw error;
      sendAdminJson(response, Number(error?.status ?? 500), {
        error: error instanceof Error ? error.message : "Process content request failed",
        code: error?.code ?? "PROCESS_CONTENT_FAILED",
      });
      return true;
    }
  };
}
