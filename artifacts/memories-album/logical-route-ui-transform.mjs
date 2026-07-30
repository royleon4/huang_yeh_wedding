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
    `export default function App() {\n  const params = new URLSearchParams(window.location.search);`,
    `export default function App() {\n  const initialRoute = readPublicRoute(window.location.pathname);\n  const params = new URLSearchParams(window.location.search);`,
    "initial public route",
  );
  code = replaceOnce(
    code,
    `  const [albums, setAlbums] = useState(fallbackAlbums);\n  const [activeCollection, setActiveCollection] = useState("wedding");\n  const [activeFilter, setActiveFilter] = useState("all");\n  const [pageSize, setPageSize] = useState(12);\n  const [selectedPhotoId, setSelectedPhotoId] = useState(null);\n  const [modal, setModal] = useState(null);`,
    `  const [albums, setAlbums] = useState(fallbackAlbums);\n  const [albumsResolved, setAlbumsResolved] = useState(false);\n  const [activeCollection, setActiveCollection] = useState(\n    initialRoute.albumId || "wedding",\n  );\n  const [activeFilter, setActiveFilter] = useState(\n    initialRoute.filterId || "all",\n  );\n  const [pageSize, setPageSize] = useState(12);\n  const [selectedPhotoId, setSelectedPhotoId] = useState(\n    initialRoute.photoId || null,\n  );\n  const [modal, setModal] = useState(\n    initialRoute.kind === "modal" ? initialRoute.modal : null,\n  );`,
    "route-backed public state",
  );
  code = replaceOnce(
    code,
    `  const openerRef = useRef(null);\n  const t = COPY[lang];`,
    `  const openerRef = useRef(null);\n  const t = COPY[lang];\n\n  const writePublicPath = (path, { replace = false } = {}) => {\n    const destination = path + window.location.search + window.location.hash;\n    window.history[replace ? "replaceState" : "pushState"]({}, "", destination);\n  };\n\n  const applyPublicRoute = (route) => {\n    if (route.kind === "modal") {\n      setModal(route.modal);\n      setSelectedPhotoId(null);\n      return;\n    }\n    setActiveCollection(route.albumId || "wedding");\n    setActiveFilter(route.filterId || "all");\n    setSelectedPhotoId(route.photoId || null);\n    setModal(null);\n    setPageSize(12);\n  };\n\n  useEffect(() => {\n    const syncFromLocation = () => {\n      const route = readPublicRoute(window.location.pathname);\n      applyPublicRoute(route);\n      if (route.canonicalPath !== window.location.pathname.replace(/\\/+$/, "")) {\n        writePublicPath(route.canonicalPath, { replace: true });\n      }\n    };\n    syncFromLocation();\n    window.addEventListener("popstate", syncFromLocation);\n    return () => window.removeEventListener("popstate", syncFromLocation);\n  }, []);`,
    "public history synchronization",
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
    `  const collectionNote =\n    configuredDescription || (fallbackNoteKey ? t[fallbackNoteKey] : "");\n\n  useEffect(() => {\n    if (!albumsResolved || albums.length === 0) return;\n    const fallbackAlbumId = albums[0]?.id || "wedding";\n    if (!albums.some((album) => album.id === activeCollection)) {\n      setActiveCollection(fallbackAlbumId);\n      setActiveFilter("all");\n      setSelectedPhotoId(null);\n      writePublicPath(publicGalleryPath({ albumId: fallbackAlbumId }), { replace: true });\n      return;\n    }\n    if (\n      activeCollection === "wedding" && activeFilter !== "all" &&\n      processes.length > 0 &&\n      !processes.some((process) => process.id === activeFilter)\n    ) {\n      setActiveFilter("all");\n      setSelectedPhotoId(null);\n      writePublicPath(publicGalleryPath({ albumId: activeCollection }), { replace: true });\n      return;\n    }\n    if (\n      activeCollection === "guest" && activeFilter !== "all" &&\n      (remotePhotos !== null || useMockFallback) &&\n      !guestGroups.some((group) => group.id === activeFilter)\n    ) {\n      setActiveFilter("all");\n      setSelectedPhotoId(null);\n      writePublicPath(publicGalleryPath({ albumId: activeCollection }), { replace: true });\n      return;\n    }\n    if (\n      activeCollection !== "wedding" && activeCollection !== "guest" &&\n      activeFilter !== "all"\n    ) {\n      setActiveFilter("all");\n      setSelectedPhotoId(null);\n      writePublicPath(publicGalleryPath({ albumId: activeCollection }), { replace: true });\n      return;\n    }\n    if (\n      selectedPhotoId && (remotePhotos !== null || useMockFallback) &&\n      !filtered.some((photo) => photo.id === selectedPhotoId)\n    ) {\n      setSelectedPhotoId(null);\n      writePublicPath(publicGalleryPath({\n        albumId: activeCollection,\n        filterId: activeFilter,\n      }), { replace: true });\n    }\n  }, [\n    activeCollection, activeFilter, albums, albumsResolved, filtered,\n    guestGroups, processes, remotePhotos, selectedPhotoId, useMockFallback,\n  ]);`,
    "invalid route recovery",
  );
  code = replaceOnce(
    code,
    `  const chooseNav = (item) => {\n    if (item.id === "all") {\n      document\n        .getElementById("archive-gallery")\n        ?.scrollIntoView({ behavior: "smooth" });\n      return;\n    }\n    if (item.id === "upload") {\n      setModal("upload");\n      return;\n    }\n    setModal("coming");\n  };\n\n  const chooseCollection = (collectionId) => {\n    setActiveCollection(collectionId);\n    setActiveFilter("all");\n    setPageSize(12);\n    setSelectedPhotoId(null);\n  };\n\n  const chooseFilter = (filterId) => {\n    setActiveFilter(filterId);\n    setPageSize(12);\n    setSelectedPhotoId(null);\n  };`,
    `  const openModalRoute = (routeId) => {\n    setModal(routeId === "upload" ? "upload" : "coming");\n    setSelectedPhotoId(null);\n    writePublicPath(publicModalPath(routeId));\n  };\n\n  const closeModal = () => {\n    setModal(null);\n    writePublicPath(publicGalleryPath({\n      albumId: activeCollection,\n      filterId: activeFilter,\n    }), { replace: true });\n  };\n\n  const chooseNav = (item) => {\n    if (item.id === "all") {\n      writePublicPath(publicGalleryPath({\n        albumId: activeCollection,\n        filterId: activeFilter,\n      }), { replace: true });\n      document.getElementById("archive-gallery")?.scrollIntoView({ behavior: "smooth" });\n      return;\n    }\n    openModalRoute(item.id);\n  };\n\n  const chooseCollection = (collectionId) => {\n    setActiveCollection(collectionId);\n    setActiveFilter("all");\n    setPageSize(12);\n    setSelectedPhotoId(null);\n    setModal(null);\n    writePublicPath(publicGalleryPath({ albumId: collectionId }));\n  };\n\n  const chooseFilter = (filterId) => {\n    setActiveFilter(filterId);\n    setPageSize(12);\n    setSelectedPhotoId(null);\n    setModal(null);\n    writePublicPath(publicGalleryPath({\n      albumId: activeCollection,\n      filterId,\n    }));\n  };\n\n  const openPhotoRoute = (photoId) => {\n    setSelectedPhotoId(photoId);\n    writePublicPath(publicGalleryPath({\n      albumId: activeCollection,\n      filterId: activeFilter,\n      photoId,\n    }));\n  };\n\n  const selectPhotoRoute = (photoId) => {\n    setSelectedPhotoId(photoId);\n    writePublicPath(publicGalleryPath({\n      albumId: activeCollection,\n      filterId: activeFilter,\n      photoId,\n    }), { replace: true });\n  };`,
    "logical public navigation",
  );
  code = replaceOnce(
    code,
    `  const closeLightbox = () => {\n    setSelectedPhotoId(null);\n    requestAnimationFrame(() => openerRef.current?.focus());\n  };`,
    `  const closeLightbox = () => {\n    setSelectedPhotoId(null);\n    writePublicPath(publicGalleryPath({\n      albumId: activeCollection,\n      filterId: activeFilter,\n    }), { replace: true });\n    requestAnimationFrame(() => openerRef.current?.focus());\n  };`,
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
