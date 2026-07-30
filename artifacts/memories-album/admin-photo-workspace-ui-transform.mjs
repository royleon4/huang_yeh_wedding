const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

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

export function adminPhotoWorkspaceUiTransform() {
  return {
    name: "admin-photo-workspace-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
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
