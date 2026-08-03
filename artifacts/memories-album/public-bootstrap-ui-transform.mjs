const APP_SUFFIX = "/src/client/App.jsx";
const MAIN_SUFFIX = "/src/client/main.jsx";
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
    `import { routeSurface } from "./route-state.mjs";\nimport { loadPublicBootstrap } from "./public-bootstrap.mjs";\nimport { applySiteStyle } from "../site-style.mjs";`,
    "public bootstrap and style imports",
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
  return `${code.slice(0, renderStart)}async function renderApplication() {\n  if (!isBatchManagement && surface === "memories") {\n    const bootstrap = await loadPublicBootstrap();\n    applySiteStyle({\n      siteStyle: bootstrap.settings.siteStyle,\n      heroBackground: bootstrap.settings.heroBackground,\n    });\n    applyServerProcesses(bootstrap.processes, bootstrap.allProcess);\n  }\n\n  const content = isBatchManagement ? (\n    <BatchManagementPage />\n  ) : surface === "login" ? (\n    <AdminLoginPage />\n  ) : surface === "admin" ? (\n    <AdminApp />\n  ) : (\n    <MemoriesRoot />\n  );\n\n  createRoot(document.getElementById("root")).render(\n    <React.StrictMode>\n      <MemoriesErrorBoundary>{content}</MemoriesErrorBoundary>\n    </React.StrictMode>,\n  );\n}\n\nvoid renderApplication();\n`;
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `import { DEFAULT_SITE_COPY, normalizeSiteCopy } from "../site-copy.mjs";`,
    `import { normalizeSiteCopy } from "../site-copy.mjs";\nimport { getPublicBootstrap } from "./public-bootstrap.mjs";\nimport { loadPublicPhotoFeed } from "./public-photo-feed.mjs";`,
    "public bootstrap app import",
  );
  code = replaceOnce(
    code,
    `  COLLECTION_DEFINITIONS,\n`,
    ``,
    "obsolete fallback album import",
  );
  code = replaceOnce(
    code,
    `  normalizePublicAlbums,\n`,
    ``,
    "obsolete album normalization import",
  );
  code = replaceOnce(
    code,
    `  DEFAULT_GALLERY_MEDIA_ORDER,\n`,
    ``,
    "obsolete gallery order default import",
  );
  code = replaceRange(
    code,
    `function fallbackAlbums() {`,
    `function Icon({ name }) {`,
    ``,
    "duplicate public data helpers",
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
    `  useEffect(() => {\n    if (runtimeState !== "ready") return undefined;`,
    `  const sourcePhotos =`,
    `  useEffect(() => {\n    if (runtimeState !== "ready") return undefined;\n    let cancelled = false;\n    const controller = new AbortController();\n\n    const exposeInitialPage = (photos) => {\n      if (cancelled) return;\n      if (photos.length > 0 || !useMockFallback) setRemotePhotos(photos);\n      setGalleryError(false);\n    };\n\n    void loadPublicPhotoFeed({\n      signal: controller.signal,\n      onInitialPage: exposeInitialPage,\n    })\n      .then((photos) => {\n        if (cancelled) return;\n        if (photos.length > 0 || !useMockFallback) setRemotePhotos(photos);\n        setGalleryError(false);\n      })\n      .catch((error) => {\n        if (cancelled || error?.name === "AbortError") return;\n        if (!useMockFallback) setGalleryError(true);\n      });\n\n    return () => {\n      cancelled = true;\n      controller.abort();\n    };\n  }, [runtimeState, useMockFallback]);\n\n`,
    "progressive public photo loading",
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
    `export default function UploadModal({ lang, onClose, onUploaded }) {\n  const t = COPY[lang] ?? COPY.zh;\n  const publicBootstrap = getPublicBootstrap();\n  const maxUploadPhotos = publicBootstrap.settings.guestUploadMaxPhotos;\n  const uploadDescription =\n    publicBootstrap.settings.uploadDescription?.[lang] ?? "";\n  const choosePhotosLabel =\n    lang === "en"\n      ? "Choose up to " + maxUploadPhotos + " photos"\n      : "選擇最多 " + maxUploadPhotos + " 張照片";\n  const tooManyPhotosMessage =\n    lang === "en"\n      ? "You can upload up to " + maxUploadPhotos +\n        " photos at a time. The first " + maxUploadPhotos + " were kept."\n      : "一次最多只能選擇 " + maxUploadPhotos +\n        " 張照片，已保留前 " + maxUploadPhotos + " 張。";`,
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
    ``,
    "upload settings and process requests",
  );
  code = replaceOnce(
    code,
    `    const selected = allSelected.slice(0, MAX_UPLOAD_PHOTOS);`,
    `    const selected = allSelected.slice(0, maxUploadPhotos);`,
    "configured guest selection limit",
  );
  code = replaceOnce(
    code,
    `    setError(allSelected.length > MAX_UPLOAD_PHOTOS ? t.tooMany : "");`,
    `    setError(allSelected.length > maxUploadPhotos ? tooManyPhotosMessage : "");`,
    "configured guest overflow message",
  );
  code = replaceOnce(
    code,
    `        files,\n        classification,`,
    `        files,\n        maxPhotos: maxUploadPhotos,\n        classification,`,
    "configured guest queue limit",
  );
  code = replaceOnce(
    code,
    `            <strong>{t.choose}</strong>`,
    `            <strong>{choosePhotosLabel}</strong>`,
    "configured guest chooser label",
  );
  code = replaceOnce(
    code,
    `          <small className="upload-hint">{t.hint}</small>`,
    `          <small className="upload-hint">{uploadDescription}</small>`,
    "configured upload description",
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
      if (normalizedId.endsWith(UPLOAD_MODAL_SUFFIX)) {
        return { code: transformUploadModal(source), map: null };
      }
      return null;
    },
  };
}
