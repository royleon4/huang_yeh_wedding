import Busboy from "busboy";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export class TemporaryPhotoError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "TemporaryPhotoError";
    this.status = status;
    this.code = code;
  }
}

export async function parsePhotoToTemporaryFile(
  request,
  {
    maxFileBytes = DEFAULT_MAX_FILE_BYTES,
    allowedFields = [],
    maxFieldBytes = 32 * 1024,
  } = {},
) {
  const permittedFields = new Set(allowedFields);
  const directory = await mkdtemp(join(tmpdir(), "memories-upload-"));
  const filePath = join(directory, `${randomUUID()}.upload`);
  let parser;
  try {
    parser = Busboy({
      headers: request.headers,
      limits: {
        files: 2,
        fields: Math.max(1, permittedFields.size),
        fieldSize: maxFieldBytes,
        fileSize: maxFileBytes,
      },
    });
  } catch {
    await rm(directory, { recursive: true, force: true });
    throw new TemporaryPhotoError(
      415,
      "Expected a multipart photo upload",
      "INVALID_MULTIPART",
    );
  }

  let fileSeen = false;
  let filename = "photo";
  let mimeType = "application/octet-stream";
  let size = 0;
  let truncated = false;
  let problem = null;
  let writePromise = null;
  const fields = {};
  const digest = createHash("sha256");

  const parsed = new Promise((resolve, reject) => {
    const fail = (error) => reject(error);

    request.once("aborted", () => {
      fail(new TemporaryPhotoError(499, "Upload cancelled", "CANCELLED"));
    });

    parser.on("file", (fieldName, stream, info) => {
      if (fieldName !== "photo" || fileSeen) {
        problem = new TemporaryPhotoError(
          400,
          "Exactly one photo is required",
          "INVALID_FILE_COUNT",
        );
        stream.resume();
        return;
      }

      fileSeen = true;
      filename = info.filename || "photo";
      mimeType = info.mimeType || "application/octet-stream";
      stream.on("limit", () => {
        truncated = true;
      });
      stream.on("data", (chunk) => {
        size += chunk.length;
        digest.update(chunk);
      });
      writePromise = pipeline(stream, createWriteStream(filePath));
    });

    parser.on("field", (fieldName, value, info) => {
      if (
        !permittedFields.has(fieldName) ||
        Object.hasOwn(fields, fieldName) ||
        info?.valueTruncated
      ) {
        problem = new TemporaryPhotoError(
          400,
          "Unexpected multipart fields",
          "INVALID_MULTIPART",
        );
        return;
      }
      fields[fieldName] = value;
    });
    parser.on("filesLimit", () => {
      problem = new TemporaryPhotoError(
        400,
        "Exactly one photo is required",
        "INVALID_FILE_COUNT",
      );
    });
    parser.on("fieldsLimit", () => {
      problem = new TemporaryPhotoError(
        400,
        "Unexpected multipart fields",
        "INVALID_MULTIPART",
      );
    });
    parser.on("error", () => {
      fail(
        new TemporaryPhotoError(
          400,
          "The multipart upload could not be read",
          "INVALID_MULTIPART",
        ),
      );
    });
    parser.on("finish", async () => {
      try {
        if (writePromise) await writePromise;
        if (problem) throw problem;
        if (!fileSeen || !writePromise) {
          throw new TemporaryPhotoError(400, "A photo is required", "PHOTO_REQUIRED");
        }
        if (truncated) {
          throw new TemporaryPhotoError(
            413,
            "The selected photo is too large",
            "PHOTO_TOO_LARGE",
          );
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    request.pipe(parser);
  });

  try {
    await parsed;
    return {
      filename,
      mimeType,
      size,
      filePath,
      directory,
      fields,
      contentHash: digest.digest("hex"),
      async readBytes() {
        return readFile(filePath);
      },
      async cleanup() {
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
