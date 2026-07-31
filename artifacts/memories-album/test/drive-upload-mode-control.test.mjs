import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readClient = (name) =>
  readFile(new URL(`../src/client/${name}`, import.meta.url), "utf8");
const readServer = (name) =>
  readFile(new URL(`../src/server/${name}`, import.meta.url), "utf8");

test("administrator can configure original transfer mode and numeric upload limits together", async () => {
  const [control, general, generalCss, uploadCss] = await Promise.all([
    readClient("DriveUploadModeSettings.jsx"),
    readClient("GeneralSettings.jsx"),
    readClient("general-settings.css"),
    readClient("upload-settings.css"),
  ]);

  assert.match(control, /value: "single"/);
  assert.match(control, /value: "chunked"/);
  assert.match(control, /driveUploadMode: draft\.driveUploadMode/);
  assert.match(control, /guestUploadMaxPhotos,/);
  assert.match(control, /adminUploadMaxPhotos,/);
  assert.match(control, /uploadDescription: draft\.uploadDescription/);
  assert.match(control, /<h3 id="upload-method-title">上傳方式<\/h3>/);
  assert.match(control, /type="radio"/);
  assert.equal((control.match(/type="number"/g) ?? []).length, 2);
  assert.match(control, /min=\{MIN_UPLOAD_PHOTOS\}/);
  assert.match(control, /max=\{MAX_SUPPORTED_UPLOAD_PHOTOS\}/);
  assert.match(general, /<DriveUploadModeSettings \/>/);
  assert.match(generalCss, /\.upload-mode-options/);
  assert.match(generalCss, /@media \(max-width: 680px\)/);
  assert.match(uploadCss, /\.upload-limit-grid/);
  assert.match(uploadCss, /\.upload-description-grid/);
  assert.match(uploadCss, /input\[aria-invalid="true"\]/);
});

test("runtime snapshots the administrator upload mode for each new original", async () => {
  const [runtime, repository, mode] = await Promise.all([
    readServer("runtime.mjs"),
    readServer("settings/repository.mjs"),
    readServer("settings/upload-mode.mjs"),
  ]);

  assert.match(runtime, /const chunkedUploadOriginal = drive\.uploadOriginal\.bind\(drive\)/);
  assert.match(runtime, /const uploadMode = await settingsRepository\.getDriveUploadMode\(\)/);
  assert.match(runtime, /uploadMode === "chunked"/);
  assert.match(runtime, /uploadOriginalSingleRequest\(\{ drive, \.\.\.options \}\)/);
  assert.match(repository, /const DRIVE_UPLOAD_MODE_KEY = "drive_upload_mode"/);
  assert.match(repository, /async getDriveUploadMode\(\)/);
  assert.match(mode, /DEFAULT_DRIVE_UPLOAD_MODE = "single"/);
});
