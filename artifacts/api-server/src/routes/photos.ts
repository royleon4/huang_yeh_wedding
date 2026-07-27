import { createGoogleDriveAdapterFromEnv } from "../integrations/google-drive/client";
import { createPublicAlbumRouter } from "../photos/publicAlbum";
import { PostgresPhotoRepository } from "../photos/repository.postgres";

const router = createPublicAlbumRouter({
  photos: new PostgresPhotoRepository(),
  drive: createGoogleDriveAdapterFromEnv(),
});

export default router;
