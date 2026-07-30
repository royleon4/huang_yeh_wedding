import { createAdminChangesApi } from "../admin/changes-api.mjs";
import { createAdminRefreshApi } from "../refresh/admin-api.mjs";
import { createAdminPhotoApi as createPhotoApi } from "./admin-api.mjs";
import { createAdminPhotoFilterApi } from "./admin-filter-api.mjs";
import { createPermanentPhotoDeleteApi } from "./permanent-delete-api.mjs";
import { createAdminPhotoUploaderApi } from "./uploader-admin-api.mjs";

export function createAdminPhotoApi(options) {
  const photoApi = createPhotoApi(options);
  const refreshApi = options.refreshService
    ? createAdminRefreshApi({
        service: options.refreshService,
        albumRepository: options.albumRepository,
        categoryRepository: options.categoryRepository,
        adminToken: options.adminToken,
      })
    : null;
  const filterApi = createAdminPhotoFilterApi({
    repository: options.repository,
    adminToken: options.adminToken,
  });
  const uploaderApi = createAdminPhotoUploaderApi({
    repository: options.repository,
    adminToken: options.adminToken,
  });
  const deleteApi = createPermanentPhotoDeleteApi({
    repository: options.repository,
    drive: options.drive,
    adminToken: options.adminToken,
  });
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
    if (refreshApi && (await refreshApi(request, response, url))) return true;
    if (await filterApi(request, response, url)) return true;
    if (await uploaderApi(request, response, url)) return true;
    if (await changesApi(request, response, url)) return true;
    if (await deleteApi(request, response, url)) return true;
    return photoApi(request, response, url);
  };
}
