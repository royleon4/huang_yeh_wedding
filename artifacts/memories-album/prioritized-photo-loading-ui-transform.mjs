const APP_SUFFIX = "/src/client/App.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Prioritized photo loading UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Prioritized photo loading UI transform could not find ${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `import { loadPublicPhotoFeed } from "./public-photo-feed.mjs";`,
    `import { getPublicPhotoFeedLoader } from "./public-photo-feed.mjs";`,
    "public photo feed import",
  );

  code = replaceRange(
    code,
    `  useEffect(() => {\n    if (runtimeState !== "ready") return undefined;\n    let cancelled = false;\n    const controller = new AbortController();`,
    `  const sourcePhotos =`,
    `  const photoFeedLoader = useMemo(() => getPublicPhotoFeedLoader(), []);\n\n  useEffect(() => {\n    if (runtimeState !== "ready") return undefined;\n    return photoFeedLoader.subscribe((snapshot) => {\n      if (snapshot.photos.length > 0 || !useMockFallback) {\n        setRemotePhotos(snapshot.photos);\n      }\n      setPhotoFeedComplete(snapshot.metadataComplete);\n      setGalleryError(\n        Boolean(snapshot.error) && snapshot.photos.length === 0 && !useMockFallback,\n      );\n    });\n  }, [photoFeedLoader, runtimeState, useMockFallback]);\n\n  useEffect(() => {\n    if (runtimeState !== "ready") return;\n    photoFeedLoader.setContext({\n      collectionId: activeCollection,\n      filterId: activeFilter,\n    });\n  }, [\n    photoFeedLoader, runtimeState, activeCollection, activeFilter,\n  ]);\n\n`,
    "progressive photo feed effect",
  );

  code = replaceOnce(
    code,
    `  const handleUploaded = (photo) => {\n    setRemotePhotos((current) => {`,
    `  const handleUploaded = (photo) => {\n    photoFeedLoader.addPhoto(photo);\n    setRemotePhotos((current) => {`,
    "uploaded photo cache integration",
  );

  return code;
}

export function prioritizedPhotoLoadingUiTransform() {
  return {
    name: "prioritized-photo-loading-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(APP_SUFFIX)) return null;
      return { code: transformApp(source), map: null };
    },
  };
}
