import { Router, type IRouter, type Request, type Response } from "express";
import type { DriveAdapter } from "../integrations/google-drive/types";
import { decodePhotoCursor, encodePhotoCursor } from "./cursor";
import type { PhotoRepository } from "./repository";

type PublicAlbumDependencies = {
  photos: PhotoRepository;
  drive: DriveAdapter;
};

export function createPublicAlbumRouter(
  dependencies: PublicAlbumDependencies,
): IRouter {
  const router = Router();

  router.get("/photos", async (req: Request, res: Response) => {
    let cursor;
    try {
      cursor =
        typeof req.query["cursor"] === "string"
          ? decodePhotoCursor(req.query["cursor"])
          : undefined;
    } catch {
      res.status(400).json({ error: "Invalid cursor" });
      return;
    }
    const requestedLimit = Number(req.query["limit"] ?? 30);
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 100
    ) {
      res.status(400).json({ error: "Limit must be between 1 and 100" });
      return;
    }

    try {
      const page = await dependencies.photos.listPublic({
        limit: requestedLimit,
        cursor,
      });
      res.json({
        photos: page.items.map((photo) => ({
          id: photo.id,
          mediaUrl: `/api/photos/${photo.id}/media`,
          contentType: photo.contentType,
          width: photo.width,
          height: photo.height,
          createdAt: photo.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor ? encodePhotoCursor(page.nextCursor) : null,
      });
    } catch (error) {
      req.log?.error({ err: error }, "Public photo listing failed");
      res.status(500).json({ error: "Unable to load photos" });
    }
  });

  router.get("/photos/:photoId/media", async (req: Request, res: Response) => {
    const rawPhotoId = req.params["photoId"];
    const photoId = typeof rawPhotoId === "string" ? rawPhotoId : "";
    if (!isPhotoId(photoId)) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    const photo = await dependencies.photos.getPublicById(photoId);
    if (!photo) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    let download;
    try {
      download = await dependencies.drive.download(photo.driveFileId);
    } catch (error) {
      req.log?.error(
        { err: error, photoId: photo.id },
        "Drive media fetch failed",
      );
      res.status(502).json({ error: "Photo is temporarily unavailable" });
      return;
    }
    res.setHeader("Content-Type", download.contentType ?? photo.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400");
    if (download.byteSize !== undefined) {
      res.setHeader("Content-Length", download.byteSize);
    }
    download.body.on("error", (error) => {
      req.log?.error(
        { err: error, photoId: photo.id },
        "Drive media stream failed",
      );
      res.destroy(error);
    });
    download.body.pipe(res);
  });

  return router;
}

function isPhotoId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
