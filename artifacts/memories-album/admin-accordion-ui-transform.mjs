const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_REFRESH_SUFFIX = "/src/client/AdminRefreshManagement.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin accordion transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceLast(source, search, replacement, label) {
  const index = source.lastIndexOf(search);
  if (index < 0) {
    throw new Error(`Admin accordion transform could not find ${label}`);
  }
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function transformRegion(source, startMarker, endMarker, transform, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Admin accordion transform could not find ${label}`);
  }
  const region = source.slice(start, end);
  return `${source.slice(0, start)}${transform(region)}${source.slice(end)}`;
}

function matchingElementEnd(source, start, tagName, label) {
  const expression = new RegExp(`<\\/?${tagName}\\b`, "g");
  expression.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = expression.exec(source))) {
    const closing = source.startsWith(`</${tagName}`, match.index);
    depth += closing ? -1 : 1;
    if (depth === 0) {
      const end = source.indexOf(">", match.index);
      if (end >= 0) return end + 1;
      break;
    }
  }
  throw new Error(`Admin accordion transform could not match ${label}`);
}

function lineIndent(source, index) {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  return source.slice(lineStart, index);
}

function indentBlock(source, indent) {
  return source
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

function wrapElementInRegion(
  source,
  { regionMarker, elementMarker, tagName, wrapperClass, summary, removeHeading, label },
) {
  const regionStart = source.indexOf(regionMarker);
  const start = source.indexOf(elementMarker, regionStart);
  if (regionStart < 0 || start < 0) {
    throw new Error(`Admin accordion transform could not find ${label}`);
  }
  const end = matchingElementEnd(source, start, tagName, label);
  const indent = lineIndent(source, start);
  let element = source.slice(start, end);
  if (removeHeading) {
    element = element.replace(removeHeading, "");
  }
  const replacement = `${indent}<details className="admin-accordion ${wrapperClass}">\n${indent}  <summary className="admin-accordion-summary">\n${indent}    ${summary}\n${indent}  </summary>\n${indent}  <div className="admin-accordion-body">\n${indentBlock(element, `${indent}    `)}\n${indent}  </div>\n${indent}</details>`;
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformAlbumEditor(region) {
  let code = replaceOnce(
    region,
    `    <form className="admin-editor-card" onSubmit={(event) => event.preventDefault()}>`,
    `    <details className="admin-editor-card admin-accordion admin-album-accordion">\n      <summary className="admin-accordion-summary admin-album-summary">\n        <span className="admin-accordion-title">\n          {draft.titleZh || album.titleZh || "未命名相簿"}\n        </span>\n        <span className="admin-accordion-secondary">\n          {draft.titleEn || album.titleEn || "未填英文名稱"}\n        </span>\n        <span className="admin-accordion-meta">\n          {album.isSystem ? "系統相簿" : "自訂相簿"}\n        </span>\n      </summary>\n      <form\n        className="admin-accordion-content admin-album-editor-form"\n        onSubmit={(event) => event.preventDefault()}\n      >`,
    "album editor opening",
  );
  code = replaceOnce(
    code,
    `      <div className="admin-editor-heading">\n        <strong>{album.titleZh}</strong>\n        <span>{album.isSystem ? "系統相簿" : "自訂相簿"}</span>\n      </div>\n`,
    "",
    "album duplicate heading",
  );
  return replaceLast(
    code,
    `    </form>\n  );`,
    `      </form>\n    </details>\n  );`,
    "album editor closing",
  );
}

function transformCategoryEditor(region) {
  let code = replaceOnce(
    region,
    `    <form\n      className="admin-editor-card admin-category-row"\n      onSubmit={(event) => event.preventDefault()}\n    >`,
    `    <details className="admin-editor-card admin-accordion admin-category-accordion">\n      <summary className="admin-accordion-summary admin-category-summary">\n        <span className="admin-accordion-number">\n          {String(category.displayOrder).padStart(2, "0")}\n        </span>\n        <span className="admin-accordion-title">\n          {draft.labelZh || category.labelZh || "未命名分類"}\n        </span>\n        <span className="admin-accordion-secondary">\n          {draft.labelEn || category.labelEn || "未填英文名稱"}\n        </span>\n      </summary>\n      <form\n        className="admin-category-row admin-accordion-content"\n        onSubmit={(event) => event.preventDefault()}\n      >`,
    "category editor opening",
  );
  return replaceLast(
    code,
    `    </form>\n  );`,
    `      </form>\n    </details>\n  );`,
    "category editor closing",
  );
}

function transformAdminApp(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport "./admin-accordion.css";`,
    "AdminApp accordion stylesheet",
  );
  code = transformRegion(
    code,
    "function AlbumEditor(",
    "\nfunction CategoryEditor(",
    transformAlbumEditor,
    "album editor function",
  );
  code = transformRegion(
    code,
    "function CategoryEditor(",
    "\nfunction AlbumChoices(",
    transformCategoryEditor,
    "category editor function",
  );
  return wrapElementInRegion(code, {
    regionMarker: `        {tab === "albums" && (`,
    elementMarker: `<form className="admin-create-card" onSubmit={(event) => event.preventDefault()}>`,
    tagName: "form",
    wrapperClass: "admin-create-accordion admin-new-album-accordion",
    summary:
      `<span className="admin-accordion-title">新增相簿</span>\n${"              "}<span className="admin-accordion-secondary">建立新的相簿</span>`,
    removeHeading: /\n\s*<h3>新增相簿<\/h3>/,
    label: "new album form",
  });
}

function transformRefreshManagement(source) {
  let code = replaceOnce(
    source,
    `import "./admin-refresh-management.css";`,
    `import "./admin-refresh-management.css";\nimport "./admin-accordion.css";`,
    "refresh management accordion stylesheet",
  );
  const start = code.indexOf(`<section\n      className="admin-refresh-management"`);
  if (start < 0) {
    throw new Error("Admin accordion transform could not find refresh section");
  }
  const end = matchingElementEnd(code, start, "section", "refresh section");
  const section = code.slice(start, end);
  const openingEnd = section.indexOf(">") + 1;
  const closingStart = section.lastIndexOf("</section>");
  let body = section.slice(openingEnd, closingStart);
  const headingStart = body.indexOf(`<div className="admin-section-heading">`);
  if (headingStart < 0) {
    throw new Error("Admin accordion transform could not find refresh heading");
  }
  const headingEnd = matchingElementEnd(
    body,
    headingStart,
    "div",
    "refresh heading",
  );
  body = `${body.slice(0, headingStart)}${body.slice(headingEnd)}`;
  const replacement = `<details className="admin-refresh-management admin-accordion admin-refresh-accordion">\n      <summary className="admin-accordion-summary">\n        <span className="admin-accordion-title">重新整理原始照片</span>\n        <span className="admin-accordion-meta">高風險操作集中區</span>\n      </summary>\n      <div className="admin-accordion-body">${body}\n      </div>\n    </details>`;
  return `${code.slice(0, start)}${replacement}${code.slice(end)}`;
}

export function adminAccordionUiTransform() {
  return {
    name: "admin-accordion-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdminApp(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_REFRESH_SUFFIX)) {
        return { code: transformRefreshManagement(source), map: null };
      }
      return null;
    },
  };
}
