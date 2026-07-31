import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { uploadSettingsUiTransform } from "../upload-settings-ui-transform.mjs";
import {
  DEFAULT_UPLOAD_DESCRIPTION,
  normalizeUploadSettings,
  isValidAdminUploadMaxPhotos,
  isValidGuestUploadMaxPhotos,
  isValidUploadDescription,
} from "../src/upload-settings.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function run(plugin, code, relativePath) {
  const id = path.join(root, relativePath);
  return plugin.transform(code, id)?.code ?? code;
}

test("upload settings only accept the tested guest and administrator limits", () => {
  assert.deepEqual(normalizeUploadSettings(), {
    guestUploadMaxPhotos: 10,
    adminUploadMaxPhotos: 30,
    uploadDescription: DEFAULT_UPLOAD_DESCRIPTION,
  });
  assert.deepEqual(
    normalizeUploadSettings({
      guestUploadMaxPhotos: 100,
      adminUploadMaxPhotos: 100,
      uploadDescription: { zh: "自訂中文", en: "Custom English" },
    }),
    {
      guestUploadMaxPhotos: 100,
      adminUploadMaxPhotos: 100,
      uploadDescription: { zh: "自訂中文", en: "Custom English" },
    },
  );
  assert.equal(isValidGuestUploadMaxPhotos(10), true);
  assert.equal(isValidGuestUploadMaxPhotos(100), true);
  assert.equal(isValidGuestUploadMaxPhotos(30), false);
  assert.equal(isValidAdminUploadMaxPhotos(30), true);
  assert.equal(isValidAdminUploadMaxPhotos(100), true);
  assert.equal(isValidAdminUploadMaxPhotos(10), false);
  assert.equal(
    isValidUploadDescription({ zh: "中文", en: "English" }),
    true,
  );
  assert.equal(isValidUploadDescription({ zh: "中文" }), false);
});

async function withUploadSettingsServer(runTest) {
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
  const server = createServer(async (request, response) => {
    if (!(await publicApi(request, response)) && !(await adminApi(request, response))) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await runTest(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("the Upload Method card saves mode, both limits, and bilingual text together", async () => {
  await withUploadSettingsServer(async (origin) => {
    const uploadDescription = {
      zh: "請選擇想分享的婚禮照片。",
      en: "Choose the wedding photos you would like to share.",
    };
    const response = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driveUploadMode: "chunked",
        guestUploadMaxPhotos: 100,
        adminUploadMaxPhotos: 100,
        uploadDescription,
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      driveUploadMode: "chunked",
      guestUploadMaxPhotos: 100,
      adminUploadMaxPhotos: 100,
      uploadDescription,
    });

    const publicResponse = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(publicResponse.status, 200);
    assert.deepEqual(await publicResponse.json(), {
      driveUploadMode: "chunked",
      guestUploadMaxPhotos: 100,
      adminUploadMaxPhotos: 100,
      uploadDescription,
    });
  });
});

test("invalid upload limits and descriptions are rejected before persistence", async () => {
  await withUploadSettingsServer(async (origin) => {
    for (const body of [
      { guestUploadMaxPhotos: 30 },
      { adminUploadMaxPhotos: 10 },
      { uploadDescription: { zh: "缺英文" } },
    ]) {
      const response = await fetch(`${origin}/admin/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).code, "INVALID_SETTING");
    }
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

test("the transformed fair queue accepts a configured one-hundred-photo selection", async () => {
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
  const files = Array.from({ length: 100 }, (_, index) => ({
    name: `${index}.jpg`,
  }));
  let uploaded = 0;
  const result = await fairUpload.uploadQueue({
    uploaderName: "Administrator",
    files,
    maxPhotos: 100,
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
  assert.equal(uploaded, 100);
  assert.equal(result.summary.success, 100);
});

test("General exposes upload limits and descriptions inside the Upload Method card", async () => {
  const [component, config, repository] = await Promise.all([
    source("src/client/DriveUploadModeSettings.jsx"),
    source("vite.routes.config.js"),
    source("src/server/settings/repository.mjs"),
  ]);
  assert.match(component, /<h3 id="upload-method-title">上傳方式<\/h3>/);
  assert.match(component, /GUEST_UPLOAD_LIMIT_OPTIONS/);
  assert.match(component, /ADMIN_UPLOAD_LIMIT_OPTIONS/);
  assert.match(component, /中文說明/);
  assert.match(component, /English description/);
  assert.match(component, /uploadDescription: draft\.uploadDescription/);
  assert.match(config, /uploadSettingsUiTransform\(\)/);
  assert.match(repository, /guest_upload_max_photos/);
  assert.match(repository, /admin_upload_max_photos/);
  assert.match(repository, /upload_description/);
});
