import { adminResponsiveLayoutUiTransform } from "./admin-responsive-layout-ui-transform.mjs";
import { albumPhotoOrderUiTransform } from "./album-photo-order-ui-transform.mjs";

const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";
const UPLOAD_MODAL_SUFFIX = "/src/client/UploadModal.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin photo workspace transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replacePhotoTab(source) {
  const startMarker = `        {tab === "photos" && (`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(`\n      </main>`, start);
  if (start < 0 || end < 0) {
    throw new Error("Admin photo workspace transform could not find photo tab");
  }

  const replacement = `        {tab === "photos" && (
          <AdminPhotoWorkspace
            albums={albums}
            categories={orderedCategories}
            photos={photos}
            initialNextCursor={nextCursor}
            busy={busy}
            refreshToken={message || error}
            setPhotos={setPhotos}
            renderPhoto={(photo) => (
              <PhotoEditor
                photo={photo}
                draft={photoDrafts[photo.id] ?? photoDraft(photo)}
                albums={albums}
                categories={orderedCategories}
                busy={busy}
                onChange={(changes) => updatePhotoDraft(photo, changes)}
                onDelete={() => void deletePhoto(photo)}
              />
            )}
          />
        )}`;

  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformDeleteFlow(source) {
  let code = replaceOnce(
    source,
    `      \`確定永久刪除「\${photo.displayName || photo.originalFilename}」嗎？\\n\\n原圖、縮圖與資料庫紀錄都會立即刪除，無法復原。\`,`,
    `      \`確定永久刪除「\${photo.displayName || photo.originalFilename}」嗎？\\n\\n若同一張照片同時存在多個相簿或流程分類，所有位置都會一起刪除。原圖、縮圖與資料庫紀錄將立即刪除，無法復原。\`,`,
    "permanent deletion confirmation",
  );

  code = replaceOnce(
    code,
    `      await adminRequest(\`/admin/api/photos/\${encodeURIComponent(photo.id)}\`, {
        method: "DELETE",
        timeoutMs: 120_000,
      });
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setPhotoDrafts((current) => {
        const next = { ...current };
        delete next[photo.id];
        return next;
      });
      setMessage("照片已永久刪除。");`,
    `      const deletion = await adminRequest(
        \`/admin/api/photos/\${encodeURIComponent(photo.id)}\`,
        {
          method: "DELETE",
          timeoutMs: 120_000,
        },
      );
      const deletedIds = new Set(
        Array.isArray(deletion.deletedIds) && deletion.deletedIds.length > 0
          ? deletion.deletedIds
          : [photo.id],
      );
      setPhotos((current) =>
        current.filter((item) => !deletedIds.has(item.id)),
      );
      setPhotoDrafts((current) => {
        const next = { ...current };
        for (const deletedId of deletedIds) delete next[deletedId];
        return next;
      });
      setMessage(
        deletedIds.size > 1
          ? \`同一張照片的 \${deletedIds.size} 筆分類紀錄已全部永久刪除。\`
          : "照片已從所有相簿與流程分類永久刪除。",
      );`,
    "photo family deletion response",
  );

  return code;
}

function transformUploadModal(source) {
  let code = replaceOnce(
    source,
    `    uploading: "上傳中",`,
    `    uploading: "正在傳送到伺服器",\n    processing: "伺服器正在整理並儲存到 Google Drive",`,
    "visitor upload Chinese processing label",
  );
  code = replaceOnce(
    code,
    `    uploading: "Uploading",`,
    `    uploading: "Sending to the server",\n    processing: "Processing and storing in Google Drive",`,
    "visitor upload English processing label",
  );
  code = replaceOnce(
    code,
    `照片逐張傳送並使用固定識別碼，重新嘗試不會重複建立 Drive 檔案。`,
    `最多同時傳送 3 張；原圖會以可續傳分段儲存到 Drive，重新嘗試會從 Drive 已接受的位置繼續。`,
    "visitor upload Chinese hint",
  );
  return replaceOnce(
    code,
    `Stable upload IDs prevent duplicate Drive files when a request is retried.`,
    `Up to three photos transfer together. Resumable Drive chunks continue from the last accepted byte after a retry.`,
    "visitor upload English hint",
  );
}

function transformAdminWorkspace(source) {
  return replaceOnce(
    source,
    `    uploading: "上傳中",`,
    `    uploading: "正在傳送到伺服器",\n    processing: "伺服器正在整理並儲存到 Google Drive",`,
    "administrator upload processing label",
  );
}

export function adminPhotoWorkspaceUiTransform() {
  const responsiveLayout = adminResponsiveLayoutUiTransform();
  const albumPhotoOrder = albumPhotoOrderUiTransform();
  return {
    name: "admin-photo-workspace-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      const albumOrderResult = albumPhotoOrder.transform(source, id);
      let code = albumOrderResult?.code ?? source;

      if (normalizedId.endsWith(UPLOAD_MODAL_SUFFIX)) {
        return { code: transformUploadModal(code), map: null };
      }
      if (normalizedId.endsWith(ADMIN_WORKSPACE_SUFFIX)) {
        return { code: transformAdminWorkspace(code), map: null };
      }
      if (!normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return albumOrderResult ? { code, map: null } : null;
      }

      code = replaceOnce(
        code,
        `import "./admin-save-bar.css";`,
        `import "./admin-save-bar.css";\nimport AdminPhotoWorkspace, { mergeAdminPhotos } from "./AdminPhotoWorkspace.jsx";`,
        "AdminApp stylesheet import",
      );
      code = replaceOnce(
        code,
        `    setPhotos(photoData.photos);`,
        `    setPhotos((current) => mergeAdminPhotos(current, photoData.photos));`,
        "canonical photo merge",
      );
      code = transformDeleteFlow(code);
      code = replacePhotoTab(code);
      return responsiveLayout.transform(code, id);
    },
  };
}
