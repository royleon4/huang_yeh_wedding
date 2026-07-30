export const DEFAULT_DRIVE_UPLOAD_MODE = "single";
export const DRIVE_UPLOAD_MODES = Object.freeze(["single", "chunked"]);

export function isValidDriveUploadMode(value) {
  return DRIVE_UPLOAD_MODES.includes(value);
}

export function normalizeDriveUploadMode(value) {
  return isValidDriveUploadMode(value) ? value : DEFAULT_DRIVE_UPLOAD_MODE;
}
