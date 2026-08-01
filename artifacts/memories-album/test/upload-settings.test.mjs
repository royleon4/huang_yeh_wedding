import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { uploadSettingsUiTransform } from "../upload-settings-ui-transform.mjs";
import {
  DEFAULT_UPLOAD_DESCRIPTION,
  MAX_SUPPORTED_UPLOAD_PHOTOS,
  MIN_UPLOAD_PHOTOS,
  normalizeUploadSettings,
  isValidAdminUploadMaxPhotos,
  isValidGuestUploadMaxPhotos,
  isValidUploadDescription,
} from "../src/upload-settings.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";
import { withRequestHandler } from "../test-support/http.mjs";
import {
  assertBooleanValidationCases,
  assertJsonErrorCases,
  patchJson,
} from "../test-support/validation.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function run(plugin, code, relativePath) {
  const id = path.join(root, relativePath);
  return plugin.transform(code, id)?.code ?? code;
}

function createUploadSettingsFixture() {
  const state = {
    driveUploadMode: "single",
    guestUploadMaxPhotos: 10,
    adminUploadMaxPhotos: 30,
    uploadDescription: { ...DEFAULT_UPLOAD_DESCRIPTION },
  };
  const repository = {
    async getPublicSettings() {
      return { ...state, uploadDescription: { ...state.uploadDescription } };
    },
    async setDriveUploadMode(value) {
      state.driveUploadMode = value;
      return { driveUploadMode: value };
    },
    async setGuestUploadMaxPhotos(value) {
      state.guestUploadMaxPhotos = Number(value);
      return { guestUploadMaxPhotos: state.guestUploadMaxPhotos };
    },
    async setAdminUploadMaxPhotos(value) {
      state.adminUploadMaxPhotos = Number(value);
      return { adminUploadMaxPhotos: state.adminUploadMaxPhotos };
    },
    async setUploadDescription(value) {
      state.uploadDescription = { ...value };
      return { uploadDescription: { ...state.uploadDescription } };
    },
  };
  const publicApi = createSettingsApi({ repository });
  const adminApi = createAdminSettingsApi({ repository });

  return {
    withServer: (runTest) =>
      withRequestHandler(
        async (request, response) =>
          (await publicApi(request, response)) ||
          (await adminApi(request, response)),
        runTest,
      ),
  };
}

const uploadLimitCases = {
  valid: [
    { name: "minimum", value: MIN_UPLOAD_PHOTOS },
    { name: "ordinary integer", value: 17 },
    { name: "larger integer", value: 64 },
    { name: "maximum", value: MAX_SUPPORTED_UPLOAD_PHOTOS },
  ],
  invalid: [
    { name: "below minimum", value: 0 },
    { name: "fraction", value: 1.5 },
    { name: "above maximum", value: 101 },
    { name: "non-number", value: "not-a-number" },
  ],
};

test("upload settings normalization preserves defaults and accepted values", () => {
  assert.deepEqual(normalizeUploadSettings(), {
    guestUploadMaxPhotos: 10,
    adminUploadMaxPhotos: 30,
    uploadDescription: DEFAULT_UPLOAD_DESCRIPTION,
  });
  assert.deepEqual(
    normalizeUploadSettings({
      guestUploadMaxPhotos: 37,
      adminUploadMaxPhotos: 82,
      uploadDescription: { zh: "自訂中文", en: "Custom English" },
    }),
    {
      guestUploadMaxPhotos: 37,
      adminUploadMaxPhotos: 82,
      uploadDescription: { zh: "自訂中文", en: "Custom English" },
    },
  );
});

test("upload setting validators define explicit accepted and rejected domains", async (t) => {
  await t.test("guest photo limit", (subtest) =>
    assertBooleanValidationCases(
      subtest,
      isValidGuestUploadMaxPhotos,
      uploadLimitCases,
    ),
  );
  await t.test("administrator photo limit", (subtest) =>
    assertBooleanValidationCases(
      subtest,
      isValidAdminUploadMaxPhotos,
      uploadLimitCases,
    ),
  );
  await t.test("bilingual upload description", (subtest) =>
    assertBooleanValidationCases(subtest, isValidUploadDescription, {
      valid: [
        {
          name: "Chinese and English text",
          value: { zh: "中文", en: "English" },
        },
      ],
      invalid: [
        { name: "missing English text", value: { zh: "中文" } },
        { name: "missing Chinese text", value: { en: "English" } },
        { name: "non-object value", value: "description" },
      ],
    }),
  );
});

test("the Upload Method card saves limits and bilingual text together", async () => {
  const { withServer } = createUploadSettingsFixture();
  await withServer(async (origin) => {
    const uploadDescription = {
      zh: "請選擇想分享的婚禮照片。",
      en: "Choose the wedding photos you would like to share.",
    };
    const expected = {
      driveUploadMode: "chunked",
      guestUploadMaxPhotos: 37,
      adminUploadMaxPhotos: 82,
      uploadDescription,
    };
    const response = await patchJson(`${origin}/admin/api/settings`, expected);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);

    const publicResponse = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(publicResponse.status, 200);
    assert.deepEqual(await publicResponse.json(), expected);
  });
});

test("invalid upload settings are rejected consistently", async (t) => {
  const { withServer } = createUploadSettingsFixture();
  await withServer(async (origin) => {
    await assertJsonErrorCases(
      t,
      [
        {
          name: "guest limit below minimum",
          value: { guestUploadMaxPhotos: 0 },
        },
        {
          name: "guest limit above maximum",
          value: { guestUploadMaxPhotos: 101 },
        },
        {
          name: "fractional administrator limit",
          value: { adminUploadMaxPhotos: 2.5 },
        },
        {
          name: "non-numeric administrator limit",
          value: { adminUploadMaxPhotos: "many" },
        },
        {
          name: "description missing English text",
          value: { uploadDescription: { zh: "缺英文" } },
        },
      ],
      (body) => patchJson(`${origin}/admin/api/settings`, body),
      { status: 422, code: "INVALID_SETTING" },
    );
  });
});

test("public and administrator upload surfaces use the saved limits and description", async () => {
  const publicPlugin = publicBootstrapUiTransform();
  const uploadPlugin = uploadSettingsUiTransform();
  const uploadModal = run(
    publicPlugin,
    await source("src/client/UploadModal.jsx"),
    "src/client/UploadModal.jsx",
  );
  const adminWorkspace = run(
    uploadPlugin,
    await source("src/client/AdminPhotoWorkspace.jsx"),
    "src/client/AdminPhotoWorkspace.jsx",
  );

  assert.match(uploadModal, /settings\.guestUploadMaxPhotos/);
  assert.match(uploadModal, /settings\.uploadDescription\?\.\[lang\]/);
  assert.match(uploadModal, /slice\(0, maxUploadPhotos\)/);
  assert.match(uploadModal, /maxPhotos: maxUploadPhotos/);
  assert.match(uploadModal, /\{choosePhotosLabel\}/);
  assert.match(uploadModal, /\{uploadDescription\}/);

  assert.match(adminWorkspace, /normalizeUploadSettings\(settings\)/);
  assert.match(adminWorkspace, /uploadSettings\.adminUploadMaxPhotos/);
  assert.match(adminWorkspace, /maxPhotos: uploadSettings\.adminUploadMaxPhotos/);
  assert.match(adminWorkspace, /uploadSettings\.uploadDescription\.zh/);
});

test("the transformed fair queue accepts an arbitrary configured selection", async () => {
  const plugin = uploadSettingsUiTransform();
  let transformed = run(
    plugin,
    await source("src/client/upload-client-fair.mjs"),
    "src/client/upload-client-fair.mjs",
  );
  const policyUrl = pathToFileURL(
    path.join(root, "src/client/fair-upload-policy.mjs"),
  ).href;
  transformed = transformed.replace(
    '"./fair-upload-policy.mjs"',
    JSON.stringify(policyUrl),
  );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transformed).toString("base64")}`;
  const fairUpload = await import(moduleUrl);
  const files = Array.from({ length: 87 }, (_, index) => ({
    name: `${index}.jpg`,
  }));
  let uploaded = 0;
  const result = await fairUpload.uploadQueue({
    uploaderName: "Administrator",
    files,
    maxPhotos: 87,
    maxConcurrent: 4,
    createBatchFn: async () => ({
      batchId: "batch",
      managementToken: "token",
    }),
    uploadFileFn: async ({ file }) => {
      uploaded += 1;
      return { id: file.name };
    },
  });
  assert.equal(uploaded, 87);
  assert.equal(result.summary.success, 87);
});

test("General exposes free numeric upload limits inside the Upload Method card", async () => {
  const [component, config, repository] = await Promise.all([
    source("src/client/DriveUploadModeSettings.jsx"),
    source("vite.routes.config.js"),
    source("src/server/settings/repository.mjs"),
  ]);
  assert.match(component, /<h3 id="upload-method-title">上傳方式<\/h3>/);
  assert.equal((component.match(/type="number"/g) ?? []).length, 2);
  assert.match(component, /min=\{MIN_UPLOAD_PHOTOS\}/);
  assert.match(component, /max=\{MAX_SUPPORTED_UPLOAD_PHOTOS\}/);
  assert.match(component, /updateLimit\("guestUploadMaxPhotos"/);
  assert.match(component, /updateLimit\("adminUploadMaxPhotos"/);
  assert.doesNotMatch(component, /GUEST_UPLOAD_LIMIT_OPTIONS/);
  assert.doesNotMatch(component, /ADMIN_UPLOAD_LIMIT_OPTIONS/);
  assert.match(component, /中文說明/);
  assert.match(component, /English description/);
  assert.match(component, /uploadDescription: draft\.uploadDescription/);
  assert.match(config, /uploadSettingsUiTransform\(\)/);
  assert.match(repository, /guest_upload_max_photos/);
  assert.match(repository, /admin_upload_max_photos/);
  assert.match(repository, /upload_description/);
});
