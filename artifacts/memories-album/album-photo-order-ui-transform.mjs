const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Album photo order UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformGallery(source) {
  let code = replaceOnce(
    source,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";`,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport { sortAlbumPhotosWithinMediaOrder } from "../../album-photo-order.mjs";`,
    "album photo sorting import",
  );

  code = replaceOnce(
    code,
    `    const query = new URLSearchParams({ limit: "100" });`,
    `    const query = new URLSearchParams({\n      limit: "100",\n      includeSortRanks: "1",\n    });`,
    "privacy-safe photo sort ranks",
  );

  code = replaceOnce(
    code,
    `    showSummary: true,\n  }));`,
    `    showSummary: true,\n    photoSortMode: "time-asc",\n  }));`,
    "fallback album photo order",
  );

  code = replaceOnce(
    code,
    `  const openerRef = useRef(null);\n  const t = COPY[lang];`,
    `  const openerRef = useRef(null);\n  const t = COPY[lang];\n  const albumRandomSeedRef = useRef(\n    globalThis.crypto?.randomUUID?.() ?? \`${"${Date.now()}"}-${"${Math.random()}"}\`,\n  );`,
    "stable random seed",
  );

  code = replaceOnce(
    code,
    `  const filtered = useMemo(\n    () =>\n      sortPhotosByMediaOrder(\n        filterPhotos(photos, activeFilter, activeCollection),\n        galleryMediaOrder,\n      ),\n    [photos, activeFilter, activeCollection, galleryMediaOrder],\n  );`,
    `  const activeCollectionDefinition =\n    albums.find((item) => item.id === activeCollection) ?? albums[0];\n  const filtered = useMemo(\n    () =>\n      sortAlbumPhotosWithinMediaOrder(\n        filterPhotos(photos, activeFilter, activeCollection),\n        galleryMediaOrder,\n        activeCollectionDefinition?.photoSortMode,\n        albumRandomSeedRef.current,\n      ),\n    [\n      photos,\n      activeFilter,\n      activeCollection,\n      galleryMediaOrder,\n      activeCollectionDefinition?.photoSortMode,\n    ],\n  );`,
    "active album photo ordering",
  );

  code = replaceOnce(
    code,
    `  const activeCollectionDefinition =\n    albums.find((item) => item.id === activeCollection) ?? albums[0];\n  const activeProcess =`,
    `  const activeProcess =`,
    "duplicate active album definition",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.showSummary !== false}\n            onChange={(event) => onChange({ showSummary: event.target.checked })}\n            disabled={busy}\n          />\n          在子流程上方顯示相簿名稱與介紹\n        </label>\n        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
    `        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.showSummary !== false}\n            onChange={(event) => onChange({ showSummary: event.target.checked })}\n            disabled={busy}\n          />\n          在子流程上方顯示相簿名稱與介紹\n        </label>\n        <label className="admin-wide-field">\n          相片排列順序\n          <select\n            value={draft.photoSortMode ?? "time-asc"}\n            onChange={(event) => onChange({ photoSortMode: event.target.value })}\n            disabled={busy}\n          >\n            <option value="random">隨機排序（重新載入時重新洗牌）</option>\n            <option value="time-asc">拍攝時間：舊到新</option>\n            <option value="time-desc">拍攝時間：新到舊</option>\n            <option value="name-asc">照片名稱：正序</option>\n            <option value="name-desc">照片名稱：反序</option>\n            <option value="author-asc">作者／上傳者：正序</option>\n            <option value="author-desc">作者／上傳者：反序</option>\n          </select>\n        </label>\n        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
    "album photo order selector",
  );

  code = replaceOnce(
    code,
    `  showSummary: true,\n};`,
    `  showSummary: true,\n  photoSortMode: "time-asc",\n};`,
    "new album photo order default",
  );

  return code;
}

export function albumPhotoOrderUiTransform() {
  return {
    name: "album-photo-order-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(APP_SUFFIX)) {
        return { code: transformGallery(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdmin(source), map: null };
      }
      return null;
    },
  };
}
