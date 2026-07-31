const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin preview pagination transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformAdminApp(source) {
  return replaceOnce(
    source,
    `adminRequest("/admin/api/photos?limit=50")`,
    `adminRequest("/admin/api/photos?limit=10")`,
    "initial administrator photo page size",
  );
}

function transformAdminWorkspace(source) {
  let code = replaceOnce(
    source,
    `import "./admin-photo-workspace.css";`,
    `import "./admin-photo-workspace.css";\nimport "./admin-photo-pagination.css";`,
    "administrator photo pagination stylesheet",
  );

  code = replaceOnce(
    code,
    `const query = new URLSearchParams({ limit: "50" });`,
    `const query = new URLSearchParams({ limit: "10" });`,
    "filtered administrator photo page size",
  );

  code = replaceOnce(
    code,
    `  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);`,
    `  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);\n  const [previewPage, setPreviewPage] = useState(0);\n  const loadedPreviewPageCount = Math.max(\n    1,\n    Math.ceil(visiblePhotos.length / 10),\n  );\n  const previewPhotos = useMemo(() => {\n    const start = previewPage * 10;\n    return visiblePhotos.slice(start, start + 10);\n  }, [visiblePhotos, previewPage]);\n  const hasPreviousPreviewPage = previewPage > 0;\n  const hasNextPreviewPage =\n    previewPage + 1 < loadedPreviewPageCount || Boolean(pageCursor);\n\n  useEffect(() => {\n    setPreviewPage(0);\n  }, [albumId, categoryId, uploaderNameFilter, refreshToken]);\n\n  useEffect(() => {\n    setPreviewPage((current) =>\n      Math.min(current, Math.max(loadedPreviewPageCount - 1, 0)),\n    );\n  }, [loadedPreviewPageCount]);`,
    "administrator photo page state",
  );

  code = replaceOnce(
    code,
    `  useEffect(() => {\n    void loadAuthors();\n  }, [loadAuthors]);`,
    `  const showNextPreviewPage = async () => {\n    const nextPage = previewPage + 1;\n    if (nextPage < loadedPreviewPageCount) {\n      setPreviewPage(nextPage);\n      return;\n    }\n    if (!pageCursor || photoLoading) return;\n    const cursor = pageCursor;\n    await loadPhotos({ append: true, cursor });\n    setPreviewPage(nextPage);\n  };\n\n  useEffect(() => {\n    void loadAuthors();\n  }, [loadAuthors]);`,
    "administrator next page loader",
  );

  code = replaceOnce(
    code,
    `        visiblePhotos={visiblePhotos}`,
    `        visiblePhotos={previewPhotos}`,
    "bulk actions limited to current photo page",
  );

  code = replaceOnce(
    code,
    `          {visiblePhotos.map((photo) => (`,
    `          {previewPhotos.map((photo) => (`,
    "administrator current photo page list",
  );

  code = replaceOnce(
    code,
    `      {pageCursor && (\n        <button\n          className="admin-load-more"\n          type="button"\n          onClick={() => void loadPhotos({ append: true, cursor: pageCursor })}\n          disabled={busy || photoLoading}\n        >\n          {photoLoading ? "載入中…" : "載入更多照片"}\n        </button>\n      )}`,
    `      {(visiblePhotos.length > 0 || pageCursor) && (\n        <nav className="admin-photo-pagination" aria-label="照片預覽分頁">\n          <button\n            type="button"\n            onClick={() => setPreviewPage((current) => Math.max(current - 1, 0))}\n            disabled={\n              busy || photoLoading || bulkBusy || !hasPreviousPreviewPage\n            }\n          >\n            上一頁\n          </button>\n          <strong aria-live="polite">\n            第 {previewPage + 1} / {loadedPreviewPageCount}\n            {pageCursor ? "+" : ""} 頁\n          </strong>\n          <button\n            type="button"\n            onClick={() => void showNextPreviewPage()}\n            disabled={busy || photoLoading || bulkBusy || !hasNextPreviewPage}\n          >\n            {photoLoading ? "載入中…" : "下一頁"}\n          </button>\n        </nav>\n      )}`,
    "administrator photo page controls",
  );

  return code;
}

export function adminPreviewPaginationUiTransform() {
  return {
    name: "admin-preview-pagination-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdminApp(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_WORKSPACE_SUFFIX)) {
        return { code: transformAdminWorkspace(source), map: null };
      }
      return null;
    },
  };
}
