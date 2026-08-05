import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { requiredEnvironmentValue } from "../config";
import { objectStorageClient } from "../lib/objectStorage";
import {
  UnsupportedPhotoTypeError,
  contentTypeForStoredPhoto,
  createStoredPhotoName,
  isStoredPhotoName,
  normalizedPhotoContentType,
} from "../lib/photoPolicy";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 20 },
  fileFilter(_request, file, callback) {
    if (!normalizedPhotoContentType(file.mimetype)) {
      callback(new UnsupportedPhotoTypeError(file.mimetype));
      return;
    }
    callback(null, true);
  },
});
const BUCKET = requiredEnvironmentValue("DEFAULT_OBJECT_STORAGE_BUCKET_ID");
const PHOTO_PREFIX = "photos/wedding/";

router.get("/photos", async (req: Request, res: Response) => {
  try {
    const [files] = await objectStorageClient.bucket(BUCKET).getFiles({
      prefix: PHOTO_PREFIX,
    });
    const names = files
      .map((file) => file.name)
      .filter((name) => name.startsWith(PHOTO_PREFIX))
      .map((name) => name.slice(PHOTO_PREFIX.length))
      .filter(isStoredPhotoName)
      .sort((left, right) => left.localeCompare(right));
    res.json({ photos: names });
  } catch (error) {
    req.log.error({ error }, "Photo listing failed");
    res.status(500).json({ error: "Unable to list photos" });
  }
});

router.post(
  "/photos/upload",
  (req: Request, res: Response, next) => {
    upload.array("photos", 20)(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: "Each photo must be 100 MB or smaller",
            code: "PHOTO_TOO_LARGE",
          });
        } else if (error.code === "LIMIT_FILE_COUNT") {
          res.status(422).json({
            error: "Upload no more than 20 photos at a time",
            code: "TOO_MANY_PHOTOS",
          });
        } else {
          res.status(400).json({
            error: "The photo upload request is invalid",
            code: error.code,
          });
        }
        return;
      }
      if (error instanceof UnsupportedPhotoTypeError) {
        res.status(415).json({
          error: "Only JPEG, PNG, WebP, GIF, HEIC, and HEIF photos are supported",
          code: error.code,
        });
        return;
      }
      if (error) return next(error);
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const files = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : [];
      if (files.length === 0) {
        res.status(400).json({
          error: "At least one photo is required",
          code: "PHOTOS_REQUIRED",
        });
        return;
      }
      const uploaded: string[] = [];
      for (const file of files) {
        const safeName = createStoredPhotoName(file.mimetype);
        const objectName = `${PHOTO_PREFIX}${safeName}`;
        const gcsFile = objectStorageClient.bucket(BUCKET).file(objectName);
        await gcsFile.save(file.buffer, {
          contentType: normalizedPhotoContentType(file.mimetype)!,
          resumable: false,
          validation: "crc32c",
        });
        uploaded.push(safeName);
      }
      res.status(201).json({ uploaded });
    } catch (error) {
      req.log.error({ error }, "Photo upload failed");
      res.status(500).json({ error: "Photo upload failed" });
    }
  },
);

router.get("/photos/image/:filename", async (req: Request, res: Response) => {
  try {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
    if (!isStoredPhotoName(filename)) {
      res.status(400).json({
        error: "The photo filename is invalid",
        code: "INVALID_PHOTO_FILENAME",
      });
      return;
    }
    const objectName = `${PHOTO_PREFIX}${filename}`;
    const file = objectStorageClient.bucket(BUCKET).file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Photo not found", code: "PHOTO_NOT_FOUND" });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader(
      "Content-Type",
      contentTypeForStoredPhoto(filename, metadata.contentType),
    );
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = file.createReadStream();
    stream.on("error", (error) => {
      req.log.error({ error, filename }, "Photo stream failed");
      if (!res.headersSent) {
        res.status(502).json({ error: "Unable to read photo" });
      } else {
        res.destroy(error as Error);
      }
    });
    stream.pipe(res);
  } catch (error) {
    req.log.error({ error }, "Photo read failed");
    res.status(500).json({ error: "Unable to read photo" });
  }
});

export default router;
