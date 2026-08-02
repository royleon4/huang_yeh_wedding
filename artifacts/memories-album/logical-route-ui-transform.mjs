const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const MAIN_SUFFIX = "/src/client/main.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Logical route UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";`,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport {\n  publicGalleryPath,\n  publicModalPath,\n  readPublicRoute,\n} from "./route-state.mjs";`,
    "public route imports",
  );
  code = replaceOnce(
    code,
    `import ProcessSelector from "./ProcessSelector.jsx";`,
    `import ProcessSelector, { requestGalleryStartScroll } from "./ProcessSelector.jsx";`,
    "gallery anchor helper import",
  );
  code = replaceOnce(
    code,
    `export default function App() {\n  const params = new URLSearchParams(window.location.search);`,
    `export default function App() {\n  const initialRoute = readPublicRoute(window.location.pathname);\n  const params = new URLSearchParams(window.location.search);`,
    "initial public route",
  );
  code = replaceOnce(
    code,
    `  const [lang, setLang] = useState(() =>\n    localStorage.getItem("memories-language") === "en" ? "en" : "zh",\n  );`,
    `  const [lang, setLang] = useState(initialRoute.language);`,
    "route-backed language",
  );
  code = replaceOnce(
    code,
    `  const [albums, setAlbums] = useState(fallbackAlbums);\n  const [activeCollection, setActiveCollection] = useState("wedding");\n  const [activeFilter, setActiveFilter] = useState("all");\n  const [pageSize, setPageSize] = useState(12);\n  const [selectedPhotoId, setSelectedPhotoId] = useState(null);\n  const [modal, setModal] = useState(null);`,
    `  const [albums, setAlbums] = useState(fallbackAlbums);\n  const [albumsResolved, setAlbumsResolved] = useState(false);\n  const [activeCollection, setActiveCollection] = useState(\n    fallbackAlbums()[initialRoute.groupIndex]?.id || "wedding",\n  );\n  const [activeFilter, setActiveFilter] = useState("all");\n  const [pageSize, setPageSize] = useState(12);\n  const [selectedPhotoId, setSelectedPhotoId] = useState(\n    initialRoute.photoId || null,\n  );\n  const [modal, setModal] = useState(\n    initialRoute.kind === "modal" ? initialRoute.modal : null,\n  );`,
    "route-backed public state",
  );
  code = replaceOnce(
    code,
    `  const openerRef = useRef(null);\n  const t = COPY[lang];`,
    `  const openerRef = useRef(null);\n  const lastAnchoredPathRef = useRef(null);\n  const t = COPY[lang];\n\n  const writePublicPath = (path, { replace = false } = {}) => {\n    const destination = path + window.location.search + window.location.hash;\n    window.history[replace ? "replaceState" : "pushState"]({}, "", destination);\n  };\n\n  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "wedding") return processes;\n    if (collectionId === "guest") return guestGroups;\n    return [];\n  };\n\n  const groupNumberFor = (collectionId = activeCollection) => {\n    const index = albums.findIndex((album) => album.id === collectionId);\n    return index >= 0 ? index + 1 : 1;\n  };\n\n  const subgroupNumberFor = (\n    collectionId = activeCollection,\n    filterId = activeFilter,\n  ) => {\n    if (!filterId || filterId === "all") return null;\n    const index = subgroupItemsFor(collectionId).findIndex(\n      (item) => item.id === filterId,\n    );\n    return index >= 0 ? index + 1 : null;\n  };\n\n  const currentGalleryPath = ({\n    language = lang,\n    collectionId = activeCollection,\n    filterId = activeFilter,\n    photoId = null,\n  } = {}) =>\n    publicGalleryPath({\n      language,\n      groupNumber: groupNumberFor(collectionId),\n      subgroupNumber: subgroupNumberFor(collectionId, filterId),\n      photoId,\n    });\n\n  const applyPublicRoute = (route) => {\n    const nextLanguage = route.language === "en" ? "en" : "zh";\n    setLang(nextLanguage);\n    localStorage.setItem("memories-language", nextLanguage);\n\n    if (route.kind === "modal") {\n      setModal(route.modal);\n      setSelectedPhotoId(null);\n      return true;\n    }\n\n    if (route.kind === "legacyGallery") {\n      const albumIndex = albums.findIndex((album) => album.id === route.albumId);\n      if (albumIndex < 0) return false;\n      const subgroups = subgroupItemsFor(route.albumId);\n      const subgroupIndex =\n        route.filterId === "all"\n          ? null\n          : subgroups.findIndex((item) => item.id === route.filterId);\n      if (route.filterId !== "all" && subgroupIndex < 0) return false;\n      const canonicalPath = publicGalleryPath({\n        language: nextLanguage,\n        groupNumber: albumIndex + 1,\n        subgroupNumber: subgroupIndex === null ? null : subgroupIndex + 1,\n        photoId: route.photoId,\n      });\n      writePublicPath(canonicalPath, { replace: true });\n      return applyPublicRoute(readPublicRoute(canonicalPath));\n    }\n\n    if (route.kind !== "gallery") return false;\n    const album = albums[route.groupIndex];\n    if (!album) return false;\n    const subgroups = subgroupItemsFor(album.id);\n    const subgroup =\n      route.subgroupIndex === null ? null : subgroups[route.subgroupIndex];\n    if (route.subgroupIndex !== null && !subgroup) return false;\n\n    setActiveCollection(album.id);\n    setActiveFilter(subgroup?.id || "all");\n    setSelectedPhotoId(route.photoId || null);\n    setModal(null);\n    setPageSize(12);\n\n    if (route.subgroupIndex !== null) {\n      const pathKey = route.canonicalPath;\n      if (lastAnchoredPathRef.current !== pathKey) {\n        lastAnchoredPathRef.current = pathKey;\n        requestGalleryStartScroll();\n      }\n    } else {\n      lastAnchoredPathRef.current = null;\n    }\n    return true;\n  };`,
    "public route helpers",
  );
  code = replaceOnce(
    code,
    `    void fetchAlbums()\n      .then((nextAlbums) => {\n        if (cancelled) return;\n        setAlbums(nextAlbums);\n        setActiveCollection((current) =>\n          nextAlbums.some((album) => album.id === current)\n            ? current\n            : (nextAlbums[0]?.id ?? ""),\n        );\n      })\n      .catch(() => {\n        // The three system albums remain available while storage recovers.\n      });`,
    `    void fetchAlbums()\n      .then((nextAlbums) => {\n        if (!cancelled) setAlbums(nextAlbums);\n      })\n      .catch(() => {\n        // The three system albums remain available while storage recovers.\n      })\n      .finally(() => {\n        if (!cancelled) setAlbumsResolved(true);\n      });`,
    "album route hydration",
  );
  code = replaceOnce(
    code,
    `  const collectionNote =\n    configuredDescription || (fallbackNoteKey ? t[fallbackNoteKey] : "");`,
    `  const collectionNote =\n    configuredDescription || (fallbackNoteKey ? t[fallbackNoteKey] : "");\n\n  useEffect(() => {\n    const syncFromLocation = () => {\n      const route = readPublicRoute(window.location.pathname);\n      const applied = applyPublicRoute(route);\n      if (\n        applied && route.kind !== "legacyGallery" &&\n        route.canonicalPath !== window.location.pathname.replace(/\\/+$/, "")\n      ) {\n        writePublicPath(route.canonicalPath, { replace: true });\n      }\n    };\n    syncFromLocation();\n    window.addEventListener("popstate", syncFromLocation);\n    return () => window.removeEventListener("popstate", syncFromLocation);\n  }, [albums, guestGroups, processes, remotePhotos, useMockFallback]);\n\n  useEffect(() => {\n    if (!albumsResolved || albums.length === 0) return;\n    const route = readPublicRoute(window.location.pathname);\n    const fallbackPath = publicGalleryPath({ language: route.language });\n    if (route.kind === "invalid") {\n      writePublicPath(fallbackPath, { replace: true });\n      applyPublicRoute(readPublicRoute(fallbackPath));\n      return;\n    }\n    if (route.kind !== "gallery") return;\n    const album = albums[route.groupIndex];\n    if (!album) {\n      writePublicPath(fallbackPath, { replace: true });\n      applyPublicRoute(readPublicRoute(fallbackPath));\n      return;\n    }\n    if (route.subgroupIndex !== null) {\n      const subgroupReady =\n        album.id !== "guest" || remotePhotos !== null || useMockFallback;\n      const subgroup = subgroupItemsFor(album.id)[route.subgroupIndex];\n      if (subgroupReady && !subgroup) {\n        const parentPath = publicGalleryPath({\n          language: route.language,\n          groupNumber: route.groupIndex + 1,\n        });\n        writePublicPath(parentPath, { replace: true });\n        applyPublicRoute(readPublicRoute(parentPath));\n        return;\n      }\n    }\n    if (\n      route.photoId && (remotePhotos !== null || useMockFallback) &&\n      !filtered.some((photo) => photo.id === route.photoId)\n    ) {\n      const parentPath = publicGalleryPath({\n        language: route.language,\n        groupNumber: route.groupIndex + 1,\n        subgroupNumber:\n          route.subgroupIndex === null ? null : route.subgroupIndex + 1,\n      });\n      writePublicPath(parentPath, { replace: true });\n      applyPublicRoute(readPublicRoute(parentPath));\n    }\n  }, [\n    albums, albumsResolved, filtered, guestGroups, processes, remotePhotos,\n    useMockFallback,\n  ]);`,
    "URL route synchronization and recovery",
  );
  code = replaceOnce(
    code,
    `  const switchLanguage = () => {\n    const next = lang === "zh" ? "en" : "zh";\n    setLang(next);\n    localStorage.setItem("memories-language", next);\n  };`,
    `  const switchLanguage = () => {\n    const next = lang === "zh" ? "en" : "zh";\n    setLang(next);\n    localStorage.setItem("memories-language", next);\n    const route = readPublicRoute(window.location.pathname);\n    if (route.kind === "modal") {\n      writePublicPath(publicModalPath(route.routeId, next));\n      return;\n    }\n    writePublicPath(\n      currentGalleryPath({ language: next, photoId: selectedPhotoId }),\n    );\n  };`,
    "language route navigation",
  );
  code = replaceOnce(
    code,
    `  const chooseNav = (item) => {\n    if (item.id === "all") {\n      document\n        .getElementById("archive-gallery")\n        ?.scrollIntoView({ behavior: "smooth" });\n      return;\n    }\n    if (item.id === "upload") {\n      setModal("upload");\n      return;\n    }\n    setModal("coming");\n  };\n\n  const chooseCollection = (collectionId) => {\n    setActiveCollection(collectionId);\n    setActiveFilter("all");\n    setPageSize(12);\n    setSelectedPhotoId(null);\n  };\n\n  const chooseFilter = (filterId) => {\n    setActiveFilter(filterId);\n    setSelectedPhotoId(null);\n  };`,
    `  const openModalRoute = (routeId) => {\n    setModal(routeId === "upload" ? "upload" : "coming");\n    setSelectedPhotoId(null);\n    writePublicPath(publicModalPath(routeId, lang));\n  };\n\n  const closeModal = () => {\n    setModal(null);\n    writePublicPath(currentGalleryPath(), { replace: true });\n  };\n\n  const chooseNav = (item) => {\n    if (item.id === "all") {\n      writePublicPath(currentGalleryPath(), { replace: true });\n      document.getElementById("archive-gallery")?.scrollIntoView({ behavior: "smooth" });\n      return;\n    }\n    openModalRoute(item.id);\n  };\n\n  const chooseCollection = (collectionId) => {\n    setActiveCollection(collectionId);\n    setActiveFilter("all");\n    setPageSize(12);\n    setSelectedPhotoId(null);\n    setModal(null);\n    writePublicPath(\n      publicGalleryPath({\n        language: lang,\n        groupNumber: groupNumberFor(collectionId),\n      }),\n    );\n  };\n\n  const chooseFilter = (filterId) => {\n    setActiveFilter(filterId);\n    setSelectedPhotoId(null);\n    setModal(null);\n    const path = currentGalleryPath({ filterId });\n    lastAnchoredPathRef.current = filterId === "all" ? null : path;\n    writePublicPath(path);\n  };\n\n  const openPhotoRoute = (photoId) => {\n    setSelectedPhotoId(photoId);\n    writePublicPath(currentGalleryPath({ photoId }));\n  };\n\n  const selectPhotoRoute = (photoId) => {\n    setSelectedPhotoId(photoId);\n    writePublicPath(currentGalleryPath({ photoId }), { replace: true });\n  };`,
    "logical public navigation",
  );
  code = replaceOnce(
    code,
    `  const closeLightbox = () => {\n    setSelectedPhotoId(null);\n    requestAnimationFrame(() => openerRef.current?.focus());\n  };`,
    `  const closeLightbox = () => {\n    setSelectedPhotoId(null);\n    writePublicPath(currentGalleryPath(), { replace: true });\n    requestAnimationFrame(() => openerRef.current?.focus());\n  };`,
    "lightbox route closing",
  );
  code = code.replaceAll(`setSelectedPhotoId(photo.id);`, `openPhotoRoute(photo.id);`);
  code = code.replaceAll(
    `setSelectedPhotoId(lightboxPhotos[index]?.id ?? null)`,
    `selectPhotoRoute(lightboxPhotos[index]?.id ?? null)`,
  );
  code = code.replaceAll(
    `setSelectedPhotoId(filtered[index]?.id ?? null)`,
    `selectPhotoRoute(filtered[index]?.id ?? null)`,
  );
  code = code.replaceAll(
    `onUpload={() => setModal("upload")}`,
    `onUpload={() => openModalRoute("upload")}`,
  );
  code = code.replaceAll(`onClose={() => setModal(null)}`, `onClose={closeModal}`);
  code = code.replaceAll(`onClick={() => setModal(null)}`, `onClick={closeModal}`);
  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport { adminTabPath, readAdminTab } from "./route-state.mjs";`,
    "admin route imports",
  );
  code = replaceOnce(
    code,
    `  const [tab, setTab] = useState("albums");`,
    `  const [tab, setTab] = useState(() => readAdminTab(window.location.pathname));`,
    "route-backed admin tab",
  );
  code = replaceOnce(
    code,
    `  useEffect(() => {\n    if (pendingCount === 0) return undefined;\n    const warn = (event) => {\n      event.preventDefault();\n      event.returnValue = "";\n    };\n    window.addEventListener("beforeunload", warn);\n    return () => window.removeEventListener("beforeunload", warn);\n  }, [pendingCount]);`,
    `  useEffect(() => {\n    if (pendingCount === 0) return undefined;\n    const warn = (event) => {\n      event.preventDefault();\n      event.returnValue = "";\n    };\n    window.addEventListener("beforeunload", warn);\n    return () => window.removeEventListener("beforeunload", warn);\n  }, [pendingCount]);\n\n  useEffect(() => {\n    const syncAdminTab = () => {\n      const nextTab = readAdminTab(window.location.pathname);\n      setTab(nextTab);\n      const canonicalPath = adminTabPath(nextTab);\n      if (window.location.pathname.replace(/\\/+$/, "") !== canonicalPath) {\n        window.history.replaceState({}, "",\n          canonicalPath + window.location.search + window.location.hash);\n      }\n    };\n    syncAdminTab();\n    window.addEventListener("popstate", syncAdminTab);\n    return () => window.removeEventListener("popstate", syncAdminTab);\n  }, []);`,
    "admin history synchronization",
  );
  code = replaceOnce(
    code,
    `  const confirmDiscard = () =>\n    pendingCount === 0 || window.confirm("尚有未儲存的變更，確定要離開嗎？");`,
    `  const confirmDiscard = () =>\n    pendingCount === 0 || window.confirm("尚有未儲存的變更，確定要離開嗎？");\n\n  const chooseAdminTab = (nextTab) => {\n    setTab(nextTab);\n    const path = adminTabPath(nextTab);\n    const destination = path + window.location.search + window.location.hash;\n    if (window.location.pathname.replace(/\\/+$/, "") === path) {\n      window.history.replaceState({}, "", destination);\n    } else {\n      window.history.pushState({}, "", destination);\n    }\n  };`,
    "admin tab navigation",
  );
  code = code.replaceAll(`onClick={() => setTab(id)}`, `onClick={() => chooseAdminTab(id)}`);
  return code;
}

function transformMain(source) {
  let code = replaceOnce(
    source,
    `import { adminSurface } from "./admin-client.mjs";`,
    `import { routeSurface } from "./route-state.mjs";`,
    "surface route import",
  );
  code = replaceOnce(
    code,
    `const surface = adminSurface(window.location.pathname);`,
    `const surface = routeSurface(window.location.pathname);`,
    "deep surface selection",
  );
  return code;
}

export function logicalRouteUiTransform() {
  return {
    name: "logical-route-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(APP_SUFFIX)) return { code: transformApp(source), map: null };
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdmin(source), map: null };
      }
      if (normalizedId.endsWith(MAIN_SUFFIX)) return { code: transformMain(source), map: null };
      return null;
    },
  };
}
