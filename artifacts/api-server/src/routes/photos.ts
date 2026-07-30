import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});
const BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const PHOTO_PREFIX = "photos/wedding/";
const IMAGE_RE = /\.(jpe?g|png|webp|gif|heic)$/i;

router.get("/photos", async (_req: Request, res: Response) => {
  try {
    const [files] = await objectStorageClient.bucket(BUCKET).getFiles({
      prefix: PHOTO_PREFIX,
    });
    const names = files
      .map((file) => file.name)
      .filter((name) => IMAGE_RE.test(name))
      .map((name) => name.replace(PHOTO_PREFIX, ""));
    res.json({ photos: names });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post(
  "/photos/upload",
  (req: Request, res: Response, next) => {
    upload.array("photos", 20)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: "File too large — maximum 100 MB per photo",
          });
        } else {
          res.status(400).json({ error: err.message });
        }
        return;
      }
      if (err) return next(err);
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files uploaded" });
        return;
      }
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = file.originalname.split(".").pop() || "jpg";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const objectName = `${PHOTO_PREFIX}${safeName}`;
        const gcsFile = objectStorageClient.bucket(BUCKET).file(objectName);
        await gcsFile.save(file.buffer, {
          contentType: file.mimetype,
          resumable: false,
        });
        uploaded.push(safeName);
      }
      res.json({ uploaded });
    } catch (err) {
      req.log.error({ err }, "Photo upload failed");
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

router.get("/photos/image/:filename", async (req: Request, res: Response) => {
  try {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
    if (!filename || !IMAGE_RE.test(filename)) {
      res.status(400).json({ error: "Invalid file type" });
      return;
    }
    const objectName = `${PHOTO_PREFIX}${filename}`;
    const file = objectStorageClient.bucket(BUCKET).file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    file.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
