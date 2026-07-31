import { isReservedGuestUploaderName } from "../../guest-uploader-policy.mjs";

export const RESERVED_GUEST_UPLOADER_ERROR_CODE = "RESERVED_UPLOADER_NAME";
export const RESERVED_GUEST_UPLOADER_MESSAGE =
  "「婚禮攝影」為保留名稱，請輸入您的真實姓名。";

function defaultReservedNameError() {
  const error = new Error(RESERVED_GUEST_UPLOADER_MESSAGE);
  error.status = 422;
  error.code = RESERVED_GUEST_UPLOADER_ERROR_CODE;
  return error;
}

export function createGuestUploadRepositoryGuard(
  repository,
  { createReservedNameError = defaultReservedNameError } = {},
) {
  if (!repository || typeof repository.createUploadBatch !== "function") {
    throw new Error("A guest upload repository is required");
  }

  return new Proxy(repository, {
    get(target, property) {
      if (property === "createUploadBatch") {
        return async (batch) => {
          if (
            batch?.uploaderType === "guest" &&
            isReservedGuestUploaderName(batch.uploaderName)
          ) {
            throw createReservedNameError();
          }
          return target.createUploadBatch(batch);
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
