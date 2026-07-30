const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Album refresh UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformGallery(source) {
  let code = replaceOnce(
    source,
    `    displayOrder: index + 1,\n  }));`,
    `    displayOrder: index + 1,\n    showSummary: true,\n  }));`,
    "fallback album summary setting",
  );

  code = replaceOnce(
    code,
    `          <div className="collection-summary">\n            <strong>\n              {activeCollectionDefinition?.[lang] ?? t.categories}\n            </strong>\n            {collectionNote && <p>{collectionNote}</p>}\n          </div>`,
    `          {activeCollectionDefinition?.showSummary !== false && (\n            <div className="collection-summary">\n              <strong>\n                {activeCollectionDefinition?.[lang] ?? t.categories}\n              </strong>\n              {collectionNote && <p>{collectionNote}</p>}\n            </div>\n          )}`,
    "public album summary block",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport AdminRefreshButton from "./AdminRefreshButton.jsx";`,
    "administrator refresh import",
  );

  code = replaceOnce(
    code,
    `        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.isVisible}\n            onChange={(event) => onChange({ isVisible: event.target.checked })}\n            disabled={busy}\n          />\n          對訪客顯示\n        </label>\n        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
    `        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.isVisible}\n            onChange={(event) => onChange({ isVisible: event.target.checked })}\n            disabled={busy}\n          />\n          對訪客顯示\n        </label>\n        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.showSummary !== false}\n            onChange={(event) => onChange({ showSummary: event.target.checked })}\n            disabled={busy}\n          />\n          在子流程上方顯示相簿名稱與介紹\n        </label>\n        <AdminRefreshButton\n          scopeType="album"\n          scopeId={album.id}\n          label={draft.titleZh || album.titleZh}\n          disabled={busy}\n        />\n        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
    "album visibility actions",
  );

  code = replaceOnce(
    code,
    `      <div className="admin-row-actions">\n        <button\n          type="button"\n          onClick={() => onMove(-1)}`,
    `      <div className="admin-row-actions">\n        <AdminRefreshButton\n          scopeType="process"\n          scopeId={category.id}\n          label={draft.labelZh || category.labelZh}\n          disabled={busy}\n        />\n        <button\n          type="button"\n          onClick={() => onMove(-1)}`,
    "process refresh action",
  );

  code = replaceOnce(
    code,
    `  descriptionEn: "",\n  isVisible: true,\n};`,
    `  descriptionEn: "",\n  isVisible: true,\n  showSummary: true,\n};`,
    "new album summary default",
  );

  return code;
}

export function albumRefreshUiTransform() {
  return {
    name: "album-refresh-ui",
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
