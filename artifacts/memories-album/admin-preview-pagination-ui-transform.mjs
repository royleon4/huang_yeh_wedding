const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";
const PINNED_PICKER_SUFFIX = "/src/client/PinnedPhotoPicker.jsx";

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
    `import AdminPhotoBulkActions from "./AdminPhotoBulkActions.jsx";`,
    `import AdminPhotoBulkActions from "./AdminPhotoBulkActions.jsx";\nimport {\n  ADMIN_PREVIEW_BATCH_SIZE,\n  ProgressivePreviewMoreButton,\n  useProgressivePreview,\n} from "./ProgressivePreview.jsx";`,
    "progressive administrator preview import",
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
    `  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);\n  const {\n    visibleItems: previewPhotos,\n    bufferedRemaining: bufferedPreviewCount,\n    revealNext: revealNextPreviewBatch,\n  } = useProgressivePreview(visiblePhotos, {\n    resetKey: [albumId, categoryId, uploaderNameFilter, refreshToken].join("::"),\n  });`,
    "administrator preview state",
  );

  code = replaceOnce(
    code,
    `        visiblePhotos={visiblePhotos}`,
    `        visiblePhotos={previewPhotos}`,
    "bulk actions limited to rendered previews",
  );

  code = replaceOnce(
    code,
    `          {visiblePhotos.map((photo) => (`,
    `          {previewPhotos.map((photo) => (`,
    "administrator rendered preview list",
  );

  code = replaceOnce(
    code,
    `      {pageCursor && (\n        <button\n          className="admin-load-more"\n          type="button"\n          onClick={() => void loadPhotos({ append: true, cursor: pageCursor })}\n          disabled={busy || photoLoading}\n        >\n          {photoLoading ? "載入中…" : "載入更多照片"}\n        </button>\n      )}`,
    `      <ProgressivePreviewMoreButton\n        remaining={bufferedPreviewCount}\n        hasNextPage={Boolean(pageCursor)}\n        loading={photoLoading}\n        disabled={busy || uploading || bulkBusy}\n        onClick={() => {\n          const cursor = pageCursor;\n          revealNextPreviewBatch();\n          if (cursor && bufferedPreviewCount < ADMIN_PREVIEW_BATCH_SIZE) {\n            void loadPhotos({ append: true, cursor });\n          }\n        }}\n      />`,
    "administrator show-more control",
  );

  return code;
}

function transformPinnedPicker(source) {
  let code = replaceOnce(
    source,
    `import LazyImage from "./LazyImage.jsx";`,
    `import LazyImage from "./LazyImage.jsx";\nimport {\n  ProgressivePreviewMoreButton,\n  useProgressivePreview,\n} from "./ProgressivePreview.jsx";`,
    "pinned preview pagination import",
  );

  code = replaceOnce(
    code,
    `  const candidates = (photos ?? []).filter((photo) => {\n    if (!normalizedQuery) return true;\n    return \`${"${photoLabel(photo)} ${photo.id}"}\`\n      .toLocaleLowerCase("zh-Hant")\n      .includes(normalizedQuery);\n  });`,
    `  const candidates = (photos ?? []).filter((photo) => {\n    if (!normalizedQuery) return true;\n    return \`${"${photoLabel(photo)} ${photo.id}"}\`\n      .toLocaleLowerCase("zh-Hant")\n      .includes(normalizedQuery);\n  });\n  const {\n    visibleItems: previewCandidates,\n    bufferedRemaining: bufferedCandidateCount,\n    revealNext: revealNextCandidateBatch,\n  } = useProgressivePreview(candidates, {\n    resetKey: [processKey, query, expanded ? "open" : "closed"].join("::"),\n  });`,
    "pinned candidate preview state",
  );

  code = replaceOnce(
    code,
    `              {candidates.map((photo) => {`,
    `              {previewCandidates.map((photo) => {`,
    "pinned candidate rendered previews",
  );

  code = replaceOnce(
    code,
    `            </div>\n          )}\n        </div>\n      )}`,
    `            </div>\n          )}\n          <ProgressivePreviewMoreButton\n            remaining={bufferedCandidateCount}\n            onClick={revealNextCandidateBatch}\n            disabled={busy}\n          />\n        </div>\n      )}`,
    "pinned candidate show-more control",
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
      if (normalizedId.endsWith(PINNED_PICKER_SUFFIX)) {
        return { code: transformPinnedPicker(source), map: null };
      }
      return null;
    },
  };
}
