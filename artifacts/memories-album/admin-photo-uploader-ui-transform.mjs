const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin uploader UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

export function adminPhotoUploaderUiTransform() {
  return {
    name: "admin-photo-uploader-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(ADMIN_APP_SUFFIX)) return null;

      let code = replaceOnce(
        source,
        'import "./admin-save-bar.css";',
        'import "./admin-save-bar.css";\nimport "./admin-photo-uploader.css";',
        "AdminApp stylesheet import",
      );

      code = replaceOnce(
        code,
        `        <label>\n          公開狀態\n          <select`,
        `        <label>\n          上傳者／作者\n          <input\n            value={draft.uploaderName}\n            onChange={(event) => onChange({ uploaderName: event.target.value })}\n            required\n            maxLength={80}\n            disabled={busy}\n          />\n        </label>\n        <label>\n          公開狀態\n          <select`,
        "photo uploader field",
      );

      // Album-owned subcategory/label validation is applied by the dedicated
      // album-label transform. This uploader transform only owns uploader and
      // deletion-protection behavior and must not assume labels belong to wedding.

      code = replaceOnce(
        code,
        `        <div className="admin-photo-actions">\n          <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
        `        {(photo.deleteProtected || draft.uploaderName === "婚禮攝影") && (\n          <p className="admin-protected-photo-note">\n            上傳者為「婚禮攝影」的照片受保護，不允許永久刪除。\n          </p>\n        )}\n        <div className="admin-photo-actions">\n          <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
        "protected photo notice",
      );

      code = replaceOnce(
        code,
        `            disabled={busy}\n            aria-label={\`永久刪除 \${draft.displayName}\`}\n            title="永久刪除照片"`,
        `            disabled={\n              busy || photo.deleteProtected || draft.uploaderName === "婚禮攝影"\n            }\n            aria-label={\`永久刪除 \${draft.displayName}\`}\n            title={\n              photo.deleteProtected || draft.uploaderName === "婚禮攝影"\n                ? "婚禮攝影照片受保護，不允許刪除"\n                : "永久刪除照片"\n            }`,
        "protected delete button",
      );

      return { code, map: null };
    },
  };
}
