const APP_SUFFIX = "/src/client/App.jsx";
const MAIN_SUFFIX = "/src/client/main.jsx";
const PROCESS_SELECTOR_SUFFIX = "/src/client/ProcessSelector.jsx";
const UPLOAD_MODAL_SUFFIX = "/src/client/UploadModal.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Public bootstrap UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Public bootstrap UI transform could not find ${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformMain(source) {
  let code = replaceOnce(
    source,
    `import React, { Component, useEffect, useState } from "react";`,
    `import React, { Component } from "react";`,
    "obsolete public hydration hooks",
  );
  code = replaceOnce(
    code,
    `import { routeSurface } from "./route-state.mjs";`,
    `import { routeSurface } from "./route-state.mjs";\nimport { loadPublicBootstrap } from "./public-bootstrap.mjs";`,
    "public bootstrap import",
  );
  code = replaceRange(
    code,
    `async function hydrateProcessesFromServer() {`,
    `const isBatchManagement =`,
    `function MemoriesRoot() {\n  return (\n    <>\n      <App />\n      <GalleryEnhancements />\n    </>\n  );\n}\n\n`,
    "legacy post-render process hydration",
  );

  const renderStart = code.indexOf(`const content = isBatchManagement ? (`);
  if (renderStart < 0) {
    throw new Error("Public bootstrap UI transform could not find application render");
  }
  return `${code.slice(0, renderStart)}async function renderApplication() {\n  if (!isBatchManagement && surface === "memories") {\n    const bootstrap = await loadPublicBootstrap();\n    applyServerProcesses(bootstrap.processes, bootstrap.allProcess);\n  }\n\n  const content = isBatchManagement ? (\n    <BatchManagementPage />\n  ) : surface === "login" ? (\n    <AdminLoginPage />\n  ) : surface === "admin" ? (\n    <AdminApp />\n  ) : (\n    <MemoriesRoot />\n  );\n\n  createRoot(document.getElementById("root")).render(\n    <React.StrictMode>\n      <MemoriesErrorBoundary>{content}</MemoriesErrorBoundary>\n    </React.StrictMode>,\n  );\n}\n\nvoid renderApplication();\n`;
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `import { DEFAULT_SITE_COPY, normalizeSiteCopy } from "../site-copy.mjs";`,
    `import { normalizeSiteCopy } from "../site-copy.mjs";\nimport { getPublicBootstrap } from "./public-bootstrap.mjs";`,
    "public bootstrap app import",
  );
  code = replaceRange(
    code,
    `function fallbackAlbums() {`,
    `async function fetchAllPhotos() {`,
    `async function fetchAllPhotos() {`,
    "duplicate album bootstrap helpers",
  );
  code = replaceOnce(
    code,
    `  const [albums, setAlbums] = useState(fallbackAlbums);\n  const [albumsResolved, setAlbumsResolved] = useState(false);`,
    `  const initialPublicBootstrap = getPublicBootstrap();\n  const [albums] = useState(() => initialPublicBootstrap.albums);\n  const albumsResolved = true;`,
    "preloaded album state",
  );
  code = replaceOnce(
    code,
    `    fallbackAlbums()[initialRoute.groupIndex]?.id || "wedding",`,
    `    initialPublicBootstrap.albums[initialRoute.groupIndex]?.id || "wedding",`,
    "route-backed preloaded album",
  );
  code = replaceOnce(
    code,
    `  const [galleryMediaOrder, setGalleryMediaOrder] = useState(() => [\n    ...DEFAULT_GALLERY_MEDIA_ORDER,\n  ]);\n  const [pinnedPhotoIdsByProcess, setPinnedPhotoIdsByProcess] = useState({});`,
    `  const galleryMediaOrder =\n    initialPublicBootstrap.settings.galleryMediaOrder;\n  const pinnedPhotoIdsByProcess =\n    initialPublicBootstrap.settings.pinnedPhotoIdsByProcess;`,
    "preloaded gallery settings",
  );
  code = replaceOnce(
    code,
    `  const [siteCopy, setSiteCopy] = useState(() => normalizeSiteCopy(DEFAULT_SITE_COPY));`,
    `  const siteCopy = normalizeSiteCopy(\n    initialPublicBootstrap.settings.siteCopy,\n  );`,
    "preloaded site copy",
  );
  code = replaceRange(
    code,
    `    void fetchAlbums()`,
    `    void fetchAllPhotos()`,
    `    void fetchAllPhotos()`,
    "duplicate album request",
  );
  code = replaceRange(
    code,
    `  useEffect(() => {\n    let cancelled = false;\n    void fetch("/Memories/api/settings"`,
    `  const sourcePhotos =`,
    `  const sourcePhotos =`,
    "duplicate settings request",
  );
  return code;
}

function transformProcessSelector(source) {
  let code = replaceOnce(
    source,
    `import { useEffect, useState } from "react";\nimport ProcessWheel from "./ProcessWheel.jsx";`,
    `import ProcessWheel from "./ProcessWheel.jsx";\nimport { getPublicBootstrap } from "./public-bootstrap.mjs";`,
    "selector bootstrap import",
  );
  code = replaceRange(
    code,
    `const DEFAULT_SETTINGS = {`,
    `function scrollToGalleryStart() {`,
    `function scrollToGalleryStart() {`,
    "selector settings request",
  );
  code = replaceRange(
    code,
    `export default function ProcessSelector(props) {`,
    `  const selectWithTraditionalPositioning = (id) => {`,
    `export default function ProcessSelector(props) {\n  const settings = getPublicBootstrap().settings;\n\n  const selectWithTraditionalPositioning = (id) => {`,
    "selector post-render hydration",
  );
  return code;
}

function transformUploadModal(source) {
  let code = replaceOnce(
    source,
    `import { useEffect, useMemo, useRef, useState } from "react";`,
    `import { useMemo, useRef, useState } from "react";`,
    "upload settings effect import",
  );
  code = replaceOnce(
    code,
    `import { retryFailedUploads, uploadQueue } from "./upload-client.mjs";`,
    `import { retryFailedUploads, uploadQueue } from "./upload-client.mjs";\nimport { getPublicBootstrap } from "./public-bootstrap.mjs";`,
    "upload bootstrap import",
  );
  code = replaceOnce(
    code,
    `export default function UploadModal({ lang, onClose, onUploaded }) {\n  const t = COPY[lang] ?? COPY.zh;`,
    `export default function UploadModal({ lang, onClose, onUploaded }) {\n  const t = COPY[lang] ?? COPY.zh;\n  const publicBootstrap = getPublicBootstrap();`,
    "upload bootstrap snapshot",
  );
  code = replaceOnce(
    code,
    `  const [categorySelectionEnabled, setCategorySelectionEnabled] =\n    useState(true);\n  const [processes, setProcesses] = useState([]);`,
    `  const [categorySelectionEnabled] = useState(\n    publicBootstrap.settings.guestUploadCategorySelectionEnabled !== false,\n  );\n  const [processes] = useState(() =>\n    normalizeProcesses(publicBootstrap.processes),\n  );`,
    "upload preloaded settings",
  );
  code = replaceRange(
    code,
    `  useEffect(() => {`,
    `  const overallProgress =`,
    `  const overallProgress =`,
    "upload settings and process requests",
  );
  return code;
}

export function publicBootstrapUiTransform() {
  return {
    name: "public-bootstrap-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(MAIN_SUFFIX)) {
        return { code: transformMain(source), map: null };
      }
      if (normalizedId.endsWith(APP_SUFFIX)) {
        return { code: transformApp(source), map: null };
      }
      if (normalizedId.endsWith(PROCESS_SELECTOR_SUFFIX)) {
        return { code: transformProcessSelector(source), map: null };
      }
      if (normalizedId.endsWith(UPLOAD_MODAL_SUFFIX)) {
        return { code: transformUploadModal(source), map: null };
      }
      return null;
    },
  };
}
