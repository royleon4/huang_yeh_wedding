import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readClient = (name) =>
  readFile(new URL(`../src/client/${name}`, import.meta.url), "utf8");
const readServer = (name) =>
  readFile(new URL(`../src/server/${name}`, import.meta.url), "utf8");

test("visitor upload offers only archive categories and wedding processes", async () => {
  const source = await readClient("UploadModal.jsx");
  assert.match(source, /guestUploadCategorySelectionEnabled/);
  assert.match(source, /value="life"/);
  assert.match(source, /value=\{`wedding:\$\{process\.id\}`\}/);
  assert.match(source, /你的姓名只會用來自動整理/);
  assert.doesNotMatch(source, /guestGroups|guestUploaderGroups|allGuests/);
});

test("disabled category selection always uploads to guest classification", async () => {
  const source = await readClient("UploadModal.jsx");
  assert.match(
    source,
    /const choice = categorySelectionEnabled \? classificationChoice : "guest"/,
  );
  assert.match(source, /\{categorySelectionEnabled && \(/);
});

test("administrator visitor upload setting lives only inside the general tab", async () => {
  const [component, general, main] = await Promise.all([
    readClient("AdminFeatureSettings.jsx"),
    readClient("GeneralSettings.jsx"),
    readClient("main.jsx"),
  ]);
  assert.match(component, /type="checkbox"/);
  assert.match(component, /允許訪客上傳時選擇照片分類/);
  assert.match(component, /\/admin\/api\/settings/);
  assert.match(general, /<AdminFeatureSettings \/>/);
  assert.doesNotMatch(main, /AdminFeatureSettings/);
});

test("runtime wires authenticated administrator settings API", async () => {
  const [runtime, settingsApi] = await Promise.all([
    readServer("runtime.mjs"),
    readServer("settings/api.mjs"),
  ]);
  assert.match(runtime, /const baseAdminSettingsApi = createAdminSettingsApi/);
  assert.match(runtime, /adminSettingsApi: async \(request, response, url\)/);
  assert.match(runtime, /return baseAdminSettingsApi\(request, response, url\)/);
  assert.match(settingsApi, /url\.pathname !== "\/admin\/api\/settings"/);
  assert.match(settingsApi, /guestUploadCategorySelectionEnabled must be a boolean/);
});
