import { Router, type IRouter, type Request, type Response } from "express";
import { objectStorageClient } from "../lib/objectStorage";

const ALBUM_PREFIX = "photos/wedding/";
const IMAGE_EXT = /\.(gif|heic|jpe?g|png|webp)$/i;

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  return id;
}

const router: IRouter = Router();

/**
 * GET /api/photos
 * List all photos from the 喜帖照片選 folder in object storage.
 */
router.get("/photos", async (req: Request, res: Response) => {
  try {
    const bucket = objectStorageClient.bucket(getBucketId());
    const [files] = await bucket.getFiles({ prefix: ALBUM_PREFIX });

    const photos = files
      .filter((f) => IMAGE_EXT.test(f.name))
      .map((f) => {
        const filename = f.name.slice(ALBUM_PREFIX.length);
        const [meta] = f.metadata ? [f.metadata] : [{}] as any;
        return {
          id: f.name,
          mediaUrl: `/api/photos/image/${encodeURIComponent(filename)}`,
          contentType:
            (meta?.contentType as string | undefined) ?? "image/jpeg",
          createdAt:
            (meta?.timeCreated as string | undefined) ??
            new Date().toISOString(),
        };
      });

    res.json({ photos, nextCursor: null });
  } catch (err) {
    req.log.error({ err }, "Failed to list photos from object storage");
    res.status(500).json({ error: "Unable to load photos" });
  }
});

/**
 * GET /api/photos/image/:filename
 * Stream a single photo from the 喜帖照片選 folder.
 */
router.get("/photos/image/:filename", async (req: Request, res: Response) => {
  try {
    const filename = decodeURIComponent(req.params["filename"] ?? "");
    if (!filename || !IMAGE_EXT.test(filename)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const objectName = `${ALBUM_PREFIX}${filename}`;
    const file = objectStorageClient.bucket(getBucketId()).file(objectName);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    const [metadata] = await file.getMetadata();
    const contentType =
      (metadata?.contentType as string | undefined) ?? "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (metadata?.size) {
      res.setHeader("Content-Length", String(metadata.size));
    }

    const stream = file.createReadStream();
    stream.on("error", (err) => {
      req.log.error({ err }, "Object storage stream error");
      res.destroy(err);
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "Failed to serve photo from object storage");
    res.status(500).json({ error: "Failed to serve photo" });
  }
});

export default router;
