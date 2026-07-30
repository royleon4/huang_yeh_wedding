const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin responsive layout transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformPhotoEditor(source) {
  const start = source.indexOf("function PhotoEditor({");
  const end = source.indexOf("\nconst EMPTY_ALBUM", start);
  if (start < 0 || end < 0) {
    throw new Error("Admin responsive layout transform could not isolate PhotoEditor");
  }

  let section = source.slice(start, end);
  section = replaceOnce(
    section,
    `  return (\n    <form className="admin-photo-card" onSubmit={(event) => event.preventDefault()}>`,
    `  return (\n    <details className="admin-photo-card">\n      <summary className="admin-photo-card-summary">`,
    "photo editor card opening",
  );
  section = replaceOnce(
    section,
    `      </div>\n      <div className="admin-photo-fields">`,
    `      </div>\n        <span className="admin-photo-summary-label">\n          {draft.displayName || photo.originalFilename}\n        </span>\n      </summary>\n      <form\n        className="admin-photo-card-editor"\n        onSubmit={(event) => event.preventDefault()}\n      >\n        <div className="admin-photo-fields">`,
    "photo editor preview boundary",
  );

  const tail = `      </div>\n    </form>\n  );\n}`;
  const tailIndex = section.lastIndexOf(tail);
  if (tailIndex < 0) {
    throw new Error("Admin responsive layout transform could not find PhotoEditor closing");
  }
  section = `${section.slice(0, tailIndex)}      </div>\n      </form>\n    </details>\n  );\n}`;

  return `${source.slice(0, start)}${section}${source.slice(end)}`;
}

export function adminResponsiveLayoutUiTransform() {
  return {
    name: "admin-responsive-layout-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(ADMIN_APP_SUFFIX)) return null;

      let code = replaceOnce(
        source,
        `import "./admin-save-bar.css";`,
        `import "./admin-save-bar.css";\nimport "./admin-responsive-layout.css";`,
        "administrator layout stylesheet import",
      );
      code = transformPhotoEditor(code);
      return { code, map: null };
    },
  };
}
