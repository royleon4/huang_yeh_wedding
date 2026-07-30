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
  return {
    name: "admin-photo-workspace-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(UPLOAD_MODAL_SUFFIX)) {
        return { code: transformUploadModal(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_WORKSPACE_SUFFIX)) {
        return { code: transformAdminWorkspace(source), map: null };
      }
      if (!normalizedId.endsWith(ADMIN_APP_SUFFIX)) return null;

      let code = replaceOnce(
        source,
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
      code = replacePhotoTab(code);
      return { code, map: null };
    },
  };
}
