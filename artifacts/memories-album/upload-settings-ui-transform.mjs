const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";
const FAIR_UPLOAD_SUFFIX = "/src/client/upload-client-fair.mjs";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Upload settings UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformFairUpload(source) {
  let code = replaceOnce(
    source,
    `  maxConcurrent = DEFAULT_MAX_CONCURRENT,\n}) {\n  const selected = Array.from(files ?? []);`,
    `  maxConcurrent = DEFAULT_MAX_CONCURRENT,\n  maxPhotos = 30,\n}) {\n  const selected = Array.from(files ?? []);`,
    "fair queue configurable limit parameter",
  );
  code = replaceOnce(
    code,
    `  if (selected.length > 30) {\n    throw new UploadClientError("Select no more than 30 photos at a time", {\n      code: "TOO_MANY_PHOTOS",\n      status: 422,\n    });\n  }`,
    `  const uploadLimit = Math.max(\n    1,\n    Math.min(Number(maxPhotos) || 30, 100),\n  );\n  if (selected.length > uploadLimit) {\n    throw new UploadClientError(\n      "Select no more than " + uploadLimit + " photos at a time",\n      {\n        code: "TOO_MANY_PHOTOS",\n        status: 422,\n      },\n    );\n  }`,
    "fair queue one-hundred-photo ceiling",
  );
  return code;
}

function transformAdminWorkspace(source) {
  let code = replaceOnce(
    source,
    `import { adminErrorMessage, adminRequest } from "./admin-client.mjs";`,
    `import { adminErrorMessage, adminRequest } from "./admin-client.mjs";\nimport { normalizeUploadSettings } from "../upload-settings.mjs";`,
    "administrator upload settings import",
  );
  code = replaceOnce(
    code,
    `const MAX_FILES = 30;`,
    `const DEFAULT_ADMIN_UPLOAD_SETTINGS = normalizeUploadSettings();`,
    "administrator default upload settings",
  );
  code = replaceOnce(
    code,
    `  const [uploadError, setUploadError] = useState("");\n  const controllerRef = useRef(null);`,
    `  const [uploadError, setUploadError] = useState("");\n  const [uploadSettings, setUploadSettings] = useState(\n    DEFAULT_ADMIN_UPLOAD_SETTINGS,\n  );\n  const controllerRef = useRef(null);`,
    "administrator upload settings state",
  );
  code = replaceOnce(
    code,
    `  const hasUnfinished = Boolean(summary?.failed || summary?.cancelled);\n\n  useEffect(() => {`,
    `  const hasUnfinished = Boolean(summary?.failed || summary?.cancelled);\n\n  useEffect(() => {\n    let cancelled = false;\n    void adminRequest("/admin/api/settings")\n      .then((settings) => {\n        if (!cancelled) setUploadSettings(normalizeUploadSettings(settings));\n      })\n      .catch((error) => {\n        if (error?.status === 401) window.location.replace("/Memories/");\n      });\n    return () => {\n      cancelled = true;\n    };\n  }, []);\n\n  useEffect(() => {`,
    "administrator upload settings load",
  );
  code = replaceOnce(
    code,
    `  const handleFiles = (event) => {\n    const selected = Array.from(event.target.files ?? []).slice(0, MAX_FILES);\n    setFiles(selected);\n    setItems(\n      selected.map((file) => ({\n        file,\n        status: "queued",\n        progress: 0,\n        attempts: 0,\n        error: null,\n      })),\n    );\n    setBatch(null);\n    setSummary(null);\n    setUploadError("");\n  };`,
    `  const handleFiles = (event) => {\n    const allSelected = Array.from(event.target.files ?? []);\n    const selected = allSelected.slice(0, uploadSettings.adminUploadMaxPhotos);\n    setFiles(selected);\n    setItems(\n      selected.map((file) => ({\n        file,\n        status: "queued",\n        progress: 0,\n        attempts: 0,\n        error: null,\n      })),\n    );\n    setBatch(null);\n    setSummary(null);\n    setUploadError(\n      allSelected.length > uploadSettings.adminUploadMaxPhotos\n        ? "一次最多只能選擇 " +\n          uploadSettings.adminUploadMaxPhotos +\n          " 張照片，已保留前 " +\n          uploadSettings.adminUploadMaxPhotos +\n          " 張。"\n        : "",\n    );\n  };`,
    "administrator configured file selection",
  );
  code = replaceOnce(
    code,
    `          uploaderName: normalizedUploader,\n          files,\n          classification: classification.classification,`,
    `          uploaderName: normalizedUploader,\n          files,\n          maxPhotos: uploadSettings.adminUploadMaxPhotos,\n          classification: classification.classification,`,
    "administrator configured queue limit",
  );
  code = replaceOnce(
    code,
    `            <p>沿用訪客端的可靠批次上傳流程，一次最多 30 張。</p>`,
    `            <p>\n              沿用可靠批次上傳流程，一次最多 {uploadSettings.adminUploadMaxPhotos} 張。\n            </p>`,
    "administrator configured limit label",
  );
  code = replaceOnce(
    code,
    `            <small>JPEG、PNG、WebP、HEIC／HEIF；每張上限 25 MB。</small>`,
    `            <small>{uploadSettings.uploadDescription.zh}</small>`,
    "administrator configurable upload description",
  );
  return code;
}

export function uploadSettingsUiTransform() {
  return {
    name: "upload-settings-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(FAIR_UPLOAD_SUFFIX)) {
        return { code: transformFairUpload(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_WORKSPACE_SUFFIX)) {
        return { code: transformAdminWorkspace(source), map: null };
      }
      return null;
    },
  };
}
