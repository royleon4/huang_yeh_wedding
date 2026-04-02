import { Router, type IRouter, type Request, type Response } from "express";
import { objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();
const BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const PHOTO_PREFIX = "photos/喜帖照片選/";

router.get("/photos", async (_req: Request, res: Response) => {
  try {
    const [files] = await objectStorageClient.bucket(BUCKET).getFiles({ prefix: PHOTO_PREFIX });
    const names = files
      .map(f => f.name)
      .filter(n => /\.(jpe?g|png|webp|gif|heic)$/i.test(n));
    res.json({ photos: names });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/photos/:folder/:filename", async (req: Request, res: Response) => {
  try {
    const { folder, filename } = req.params;
    const objectName = `photos/${folder}/${filename}`;
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
