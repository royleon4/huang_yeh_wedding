import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readClient = (name) =>
  readFile(new URL(`../src/client/${name}`, import.meta.url), "utf8");
const readServer = (name) =>
  readFile(new URL(`../src/server/${name}`, import.meta.url), "utf8");

test("administrator can choose unchunked or chunked original uploads", async () => {
  const [control, general, css] = await Promise.all([
    readClient("DriveUploadModeSettings.jsx"),
    readClient("GeneralSettings.jsx"),
    readClient("general-settings.css"),
  ]);

  assert.match(control, /value: "single"/);
  assert.match(control, /value: "chunked"/);
  assert.match(control, /body: \{ driveUploadMode: draftMode \}/);
  assert.match(control, /目前預設為不分塊上傳/);
  assert.match(control, /type="radio"/);
  assert.match(general, /<DriveUploadModeSettings \/>/);
  assert.match(css, /\.upload-mode-options/);
  assert.match(css, /@media \(max-width: 680px\)/);
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
