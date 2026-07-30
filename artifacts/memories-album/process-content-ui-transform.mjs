const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Process content UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformGallery(source) {
  let code = replaceOnce(
    source,
    `  COLLECTION_DEFINITIONS,`,
    `  ALL_PROCESS_DEFINITION,\n  COLLECTION_DEFINITIONS,`,
    "all-process model import",
  );

  code = replaceOnce(
    code,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";`,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport ProcessRichContent, {\n  ProcessDivider,\n  hasRichContent,\n} from "./ProcessRichContent.jsx";`,
    "process rich content import",
  );

  code = replaceOnce(
    code,
    `      <div className="process-video-divider" aria-hidden="true" />\n`,
    ``,
    "legacy process video divider",
  );

  code = replaceOnce(
    code,
    `  const activeProcess =\n    activeCollection === "wedding" && activeFilter !== "all"\n      ? processes.find((process) => process.id === activeFilter)\n      : null;\n  const hasProcessVideo = Boolean(activeProcess?.youtubeVideoId);`,
    `  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : processes.find((process) => process.id === activeFilter)\n      : null;\n  const activeProcessHtml =\n    activeProcess?.[lang === "zh" ? "contentHtmlZh" : "contentHtmlEn"] ?? "";\n  const hasProcessVideo = Boolean(activeProcess?.youtubeVideoId);\n  const hasProcessContent = hasRichContent(activeProcessHtml);\n  const photosSuppressed =\n    activeCollection === "wedding" &&\n    activeFilter === "all" &&\n    !ALL_PROCESS_DEFINITION.showAllPhotos;`,
    "active process content state",
  );

  code = replaceOnce(
    code,
    `                {t.allProcesses}\n              </button>`,
    `                {ALL_PROCESS_DEFINITION[lang] || t.allProcesses}\n              </button>`,
    "all-process chip label",
  );

  code = replaceOnce(
    code,
    `        ] ?? t.allProcesses`,
    `        ] ?? ALL_PROCESS_DEFINITION[lang] ?? t.allProcesses`,
    "photo all-process label",
  );

  code = replaceOnce(
    code,
    `            (filtered.length === 0 && !hasProcessVideo ? (`,
    `            (filtered.length === 0 &&\n            !hasProcessVideo &&\n            !hasProcessContent &&\n            !photosSuppressed ? (`,
    "empty gallery media condition",
  );

  code = replaceOnce(
    code,
    `                {hasProcessVideo && (\n                  <ProcessVideo process={activeProcess} lang={lang} />\n                )}\n                {filtered.length === 0 ? (`,
    `                {hasProcessVideo && (\n                  <ProcessVideo process={activeProcess} lang={lang} />\n                )}\n                {hasProcessVideo && (hasProcessContent || filtered.length > 0) && (\n                  <ProcessDivider\n                    paddingTop={activeProcess?.dividerPaddingTop}\n                    paddingBottom={activeProcess?.dividerPaddingBottom}\n                  />\n                )}\n                {hasProcessContent && (\n                  <ProcessRichContent html={activeProcessHtml} />\n                )}\n                {hasProcessContent && filtered.length > 0 && (\n                  <ProcessDivider\n                    paddingTop={activeProcess?.dividerPaddingTop}\n                    paddingBottom={activeProcess?.dividerPaddingBottom}\n                  />\n                )}\n                {filtered.length === 0 ? (`,
    "process media sequence",
  );

  code = replaceOnce(
    code,
    `                {filtered.length === 0 ? (\n                  <StateCard icon="✦" title={t.emptyTitle} body={t.emptyBody} />\n                ) : (`,
    `                {filtered.length === 0 ? (\n                  photosSuppressed ? null : (\n                    <StateCard icon="✦" title={t.emptyTitle} body={t.emptyBody} />\n                  )\n                ) : (`,
    "suppressed all-process photo state",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport ProcessContentEditor, { AllProcessEditor } from "./ProcessContentEditor.jsx";\nimport "./process-content-admin.css";`,
    "admin process content imports",
  );

  code = replaceOnce(
    code,
    `      <div className="admin-row-actions">`,
    `      <ProcessContentEditor processKey={category.id} />\n      <div className="admin-row-actions">`,
    "category rich content editor",
  );

  code = replaceOnce(
    code,
    `              <span>{categories.length} 個分類</span>`,
    `              <span>{categories.length + 1} 個分類</span>`,
    "category count",
  );

  code = replaceOnce(
    code,
    `            <div className="admin-editor-list">\n              {orderedCategories.map((category, index) => (`,
    `            <div className="admin-editor-list">\n              <AllProcessEditor />\n              {orderedCategories.map((category, index) => (`,
    "fixed all-process editor",
  );

  code = replaceOnce(
    code,
    `                    value={upload.categoryId}\n                    onChange={(event) =>\n                      setUpload((current) => ({ ...current, categoryId: event.target.value }))\n                    }\n                    disabled={busy}`,
    `                    value={upload.categoryId}\n                    onChange={(event) =>\n                      setUpload((current) => ({ ...current, categoryId: event.target.value }))\n                    }\n                    disabled={busy || !upload.albumIds.includes("wedding")}`,
    "new-photo wedding category guard",
  );

  code = replaceOnce(
    code,
    `                  onChange={(albumIds) =>\n                    setUpload((current) => ({ ...current, albumIds }))\n                  }`,
    `                  onChange={(albumIds) =>\n                    setUpload((current) => ({\n                      ...current,\n                      albumIds,\n                      categoryId: albumIds.includes("wedding") ? current.categoryId : "",\n                    }))\n                  }`,
    "new-photo category clearing",
  );

  return code;
}

export function processContentUiTransform() {
  return {
    name: "process-content-ui",
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
