import { createAdminChangesApi } from "../admin/changes-api.mjs";
import { createAdminPhotoApi as createPhotoApi } from "./admin-api.mjs";

export function createAdminPhotoApi(options) {
  const photoApi = createPhotoApi(options);
  const changesApi = createAdminChangesApi({
    albumRepository: options.albumRepository,
    categoryRepository: options.categoryRepository,
    photoRepository: options.repository,
    synchronizer: options.synchronizer,
    drive: options.drive,
    adminToken: options.adminToken,
    createId: options.createId,
  });

  return async function handleAdminPhotoAndChangesApi(request, response, url) {
    if (await changesApi(request, response, url)) return true;
    return photoApi(request, response, url);
  };
}
