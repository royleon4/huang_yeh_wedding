const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Message album UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformRegion(source, startMarker, endMarker, transform, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Message album UI transform could not find ${label}`);
  }
  return `${source.slice(0, start)}${transform(source.slice(start, end))}${source.slice(end)}`;
}

function albumTypeField({ draftName, disabledExpression }) {
  return `        <label>
          類別 / Type
          <select
            value={${draftName}.albumType ?? "album"}
            onChange={(event) => onChange({ albumType: event.target.value })}
            disabled={${disabledExpression}}
          >
            <option value="album">相簿 / Album</option>
            <option value="message" disabled={${draftName}.albumType !== "message"}>
              留言 / Message（僅允許一個 / One only）
            </option>
            <option value="blog">網誌 / Blog</option>
          </select>
        </label>
`;
}

function newAlbumTypeField() {
  return `                <label>
                  類別 / Type
                  <select
                    value={newAlbum.albumType ?? "album"}
                    onChange={(event) =>
                      setNewAlbum((current) => ({
                        ...current,
                        albumType: event.target.value,
                      }))
                    }
                    disabled={busy}
                  >
                    <option value="album">相簿 / Album</option>
                    <option value="message" disabled>
                      留言 / Message（留言區已建立 / Guestbook already exists）
                    </option>
                    <option value="blog">網誌 / Blog</option>
                  </select>
                </label>
`;
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";`,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport MessageAlbum from "./MessageAlbum.jsx";`,
    "message album import",
  );

  code = replaceOnce(
    code,
    `  const activeCollectionDefinition =\n    albums.find((item) => item.id === activeCollection) ?? albums[0];`,
    `  const activeCollectionDefinition =\n    albums.find((item) => item.id === activeCollection) ?? albums[0];\n  const isMessageAlbum =\n    activeCollectionDefinition?.albumType === "message";`,
    "active message album state",
  );

  code = replaceOnce(
    code,
    `            <p>\n              {filtered.length} {t.photosCount}\n            </p>`,
    `            {!isMessageAlbum && (\n              <p>\n                {filtered.length} {t.photosCount}\n              </p>\n            )}`,
    "photo count visibility",
  );

  code = replaceOnce(
    code,
    `          {stateView ??`,
    `          {isMessageAlbum ? (\n            <MessageAlbum\n              lang={lang}\n              albumId={activeCollectionDefinition.id}\n            />\n          ) : stateView ??`,
    "message album gallery body",
  );

  const selectorPattern = /<ProcessSelector\n(\s*)ariaLabel=/g;
  let selectorCount = 0;
  code = code.replace(selectorPattern, (_match, indentation) => {
    selectorCount += 1;
    return `<ProcessSelector\n${indentation}language={lang}\n${indentation}ariaLabel=`;
  });
  if (selectorCount < 2) {
    throw new Error(
      "Message album UI transform could not translate every process selector hint",
    );
  }

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport AdminMessagesPanel from "./AdminMessagesPanel.jsx";`,
    "administrator message import",
  );

  code = transformRegion(
    code,
    "function AlbumEditor(",
    "\nfunction CategoryEditor(",
    (region) => {
      let next = replaceOnce(
        region,
        `        <label className="admin-wide-field">\n          中文說明`,
        `${albumTypeField({
          draftName: "draft",
          disabledExpression: "busy || (album.isSystem && album.albumType === \"message\")",
        })}        <label className="admin-wide-field">\n          中文說明`,
        "existing album type field",
      );
      next = replaceOnce(
        next,
        `      </form>\n    </details>`,
        `      </form>\n      {album.albumType === "message" && (\n        <AdminMessagesPanel />\n      )}\n    </details>`,
        "message album administrator panel",
      );
      return next;
    },
    "album editor function",
  );

  code = transformRegion(
    code,
    `        {tab === "albums" && (`,
    `\n        {tab === "categories" && (`,
    (region) =>
      replaceOnce(
        region,
        `                <label className="admin-wide-field">\n                  中文說明`,
        `${newAlbumTypeField()}                <label className="admin-wide-field">\n                  中文說明`,
        "new album type field",
      ),
    "album administration section",
  );

  code = replaceOnce(
    code,
    `  descriptionEn: "",\n  isVisible: true,`,
    `  descriptionEn: "",\n  albumType: "album",\n  isVisible: true,`,
    "new album default type",
  );

  return code;
}

export function messageAlbumUiTransform() {
  return {
    name: "message-album-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(APP_SUFFIX)) {
        return { code: transformApp(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdmin(source), map: null };
      }
      return null;
    },
  };
}
