import { readFile, writeFile, rm } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change produced for ${path}`);
  await writeFile(path, after);
}

function replaceOne(source, search, replacement, label) {
  if (typeof search === "string") {
    const count = source.split(search).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
    return source.replace(search, replacement);
  }
  const flags = search.flags.includes("g") ? search.flags : `${search.flags}g`;
  const matches = [...source.matchAll(new RegExp(search.source, flags))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected one match, found ${matches.length}`);
  }
  return source.replace(search, replacement);
}

await edit("artifacts/memories-album/src/client/RichTextEditor.jsx", (source) => {
  let next = source;
  next = replaceOne(
    next,
    'import { AttachmentCard, WeddingImage } from "./TiptapMediaNodes.jsx";',
    'import { WeddingImage } from "./TiptapMediaNodes.jsx";',
    "remove attachment card import",
  );
  next = replaceOne(
    next,
    'import { PageDocument } from "./TiptapPageDocumentNode.jsx";\n',
    "",
    "remove page document node import",
  );
  next = replaceOne(
    next,
    /import \{\n  isPageDocumentAttachment,\n  pageDocumentKind,\n  pageDocumentLabel,\n\} from "\.\/page-document\.mjs";\n/,
    "",
    "remove page document helpers",
  );
  next = replaceOne(
    next,
    'import "./page-document.css";\n',
    "",
    "remove page document styles",
  );
  next = replaceOne(
    next,
    /const DOCUMENT_IMPORT_ACCEPT = \[[\s\S]*?const ATTACHMENT_ACCEPT = \[[\s\S]*?\]\.join\(","\);/,
    `const IMAGE_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const IMAGE_UPLOAD_ACCEPT = [...IMAGE_UPLOAD_MIME_TYPES].join(",");`,
    "replace document and attachment accept lists",
  );
  next = replaceOne(
    next,
    `        !current.isActive("weddingImage") &&
        !current.isActive("attachmentCard") &&
        !current.isActive("wordDocument") &&
        !current.isActive("pageDocument")`,
    `        !current.isActive("weddingImage") &&
        !current.isActive("wordDocument")`,
    "remove unused bubble-menu node checks",
  );
  next = replaceOne(
    next,
    '        placeholder: "在這裡輸入文字，或加入可拖曳的圖片與附件…",',
    '        placeholder: "在這裡輸入文字，或加入可拖曳的圖片…",',
    "image-only placeholder",
  );
  next = replaceOne(
    next,
    `      WeddingImage,
      AttachmentCard,
      WordDocument,
      PageDocument,`,
    `      WeddingImage,
      WordDocument,`,
    "remove unused editor extensions",
  );
  next = replaceOne(
    next,
    /  const insertAttachment = \(attachment\) => \{[\s\S]*?\n  \};\n\n  const upload = async/,
    `  const insertImage = (attachment) => {
    if (!editor || !attachment?.isImage || !attachment.url) return;
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "weddingImage",
          attrs: {
            src: attachment.url,
            alt: attachment.name || "",
            caption: attachment.name || "",
            width: 100,
          },
        },
        { type: "paragraph" },
      ])
      .run();
  };

  const upload = async`,
    "replace generic attachment insertion with image insertion",
  );
  next = replaceOne(
    next,
    `    if (!file || !onUploadAttachment || !editor) return;
    setUploading(true);`,
    `    if (!file || !onUploadAttachment || !editor) return;
    if (!IMAGE_UPLOAD_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
      setUploadError("只能上傳 JPG、PNG、WebP 或 GIF 圖片。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);`,
    "validate image-only upload",
  );
  next = replaceOne(
    next,
    `      const attachment = await onUploadAttachment(file);
      insertAttachment(attachment);
      if (isPageDocumentAttachment(attachment)) {
        const kind = pageDocumentKind(attachment);
        setImportMessage(
          \`已將「\${attachment.name || pageDocumentLabel(kind)}」以\${pageDocumentLabel(kind)}保真區塊插入游標位置。\`,
        );
      }`,
    `      const attachment = await onUploadAttachment(file);
      if (!attachment?.isImage) {
        throw new Error("伺服器沒有將此檔案辨識為圖片。");
      }
      insertImage(attachment);`,
    "remove PDF and PowerPoint upload routing",
  );
  next = replaceOne(
    next,
    /\n  const importDocument = async \(file\) => \{[\s\S]*?\n  \};\n/,
    "\n",
    "remove unified non-Word importer",
  );
  next = replaceOne(
    next,
    `            label={importingWord || uploading ? "匯入中" : "匯入文件"}
            icon={importingWord || uploading ? "…" : "檔"}`,
    `            label={importingWord ? "匯入中" : "匯入 Word"}
            icon={importingWord ? "…" : "W"}`,
    "restore Word-only button",
  );
  next = replaceOne(
    next,
    `            accept={DOCUMENT_IMPORT_ACCEPT}
            disabled={disabled || importingWord || uploading}
            onChange={(event) => void importDocument(event.target.files?.[0] ?? null)}`,
    `            accept={WORD_IMPORT_ACCEPT}
            disabled={disabled || importingWord || uploading}
            onChange={(event) => void importWord(event.target.files?.[0] ?? null)}`,
    "restore Word-only input",
  );
  next = replaceOne(
    next,
    '            label={uploading ? "上傳中" : "加入圖片或附件"}',
    '            label={uploading ? "上傳中" : "加入圖片"}',
    "rename image upload control",
  );
  next = replaceOne(
    next,
    "            accept={ATTACHMENT_ACCEPT}",
    "            accept={IMAGE_UPLOAD_ACCEPT}",
    "image-only file accept",
  );
  next = replaceOne(
    next,
    "        反白文字可快速套用格式。手機請點選圖片或附件後使用移動與寬度控制；桌面仍可拖曳，並可拉動把手調整大小。「匯入文件」支援 .docx、.pdf、.ppt 與 .pptx。Word 會自動判斷可編輯或保真模式；PDF 與 PowerPoint 會在游標位置插入保留原頁面或投影片配置的文件區塊。",
    "        反白文字可快速套用格式。手機請點選圖片後使用移動與寬度控制；桌面仍可拖曳，並可拉動把手調整大小。「匯入 Word」只接受 .docx，並自動判斷可編輯或保真模式；「加入圖片」只接受 JPG、PNG、WebP 或 GIF。",
    "replace editor hint",
  );
  next = replaceOne(
    next,
    `        : "p";

  return (`,
    `        : "p";
  const imageAttachments = attachments.filter((attachment) => attachment.isImage);

  return (`,
    "derive image-only attachment library",
  );
  next = next.replaceAll("attachments.length > 0", "imageAttachments.length > 0");
  next = next.replaceAll("已上傳素材（{attachments.length}）", "已上傳圖片（{imageAttachments.length}）");
  next = next.replaceAll("{attachments.map((attachment) => (", "{imageAttachments.map((attachment) => (");
  next = replaceOne(
    next,
    '<strong>{attachment.isImage ? "圖片" : "附件"}</strong>',
    "<strong>圖片</strong>",
    "image-only library type",
  );
  next = replaceOne(
    next,
    "onClick={() => insertAttachment(attachment)}",
    "onClick={() => insertImage(attachment)}",
    "image library insertion",
  );
  return next;
});

await edit("artifacts/memories-album/src/client/ProcessRichContent.jsx", (source) => {
  let next = source;
  next = replaceOne(
    next,
    'import { pageDocumentKind, renderPageDocumentFromUrl } from "./page-document.mjs";\n',
    "",
    "remove page document public import",
  );
  next = replaceOne(
    next,
    'import "./page-document.css";\n',
    "",
    "remove page document public styles",
  );
  for (const className of [
    "process-page-document",
    "process-page-document-preview",
    "process-page-document-fallback",
  ]) {
    next = next.replace(`  "${className}",\n`, "");
  }
  next = replaceOne(
    next,
    'const SAFE_PAGE_DOCUMENT_KINDS = new Set(["pdf", "pptx", "ppt"]);\n',
    "",
    "remove page document kind allowlist",
  );
  next = replaceOne(
    next,
    '/data-type=["\'](?:word-document|page-document)["\']/i.test(html)',
    '/data-type=["\']word-document["\']/i.test(html)',
    "Word-only rich content detection",
  );
  next = replaceOne(
    next,
    /\n      const isPageDocument =[\s\S]*?\n      \}\n\n      if \(\n        child\.tagName === "DIV" &&\n        \(classNames\.includes\("process-word-document-preview"\) \|\|\n          classNames\.includes\("process-page-document-preview"\)\)\n      \) \{/,
    `
      if (
        child.tagName === "DIV" &&
        classNames.includes("process-word-document-preview")
      ) {`,
    "remove page document sanitizer",
  );
  next = replaceOne(
    next,
    /\nfunction usePageDocumentPreviews\(rootRef, sanitized\) \{[\s\S]*?\n\}\n\nexport function ProcessDivider/,
    "\nexport function ProcessDivider",
    "remove page document hydration",
  );
  next = replaceOne(
    next,
    "  usePageDocumentPreviews(rootRef, sanitized);\n",
    "",
    "remove page document hydration call",
  );
  return next;
});

await edit("artifacts/memories-album/src/client/TiptapMediaNodes.jsx", (source) => {
  let next = source;
  next = replaceOne(
    next,
    'import { Node, mergeAttributes } from "@tiptap/core";',
    'import { Node } from "@tiptap/core";',
    "remove mergeAttributes import",
  );
  next = replaceOne(
    next,
    'import { recoverUtf8Filename } from "../filename-encoding.mjs";\n',
    "",
    "remove attachment filename import",
  );
  next = replaceOne(
    next,
    /\nfunction formatBytes\(value\) \{[\s\S]*?\nfunction moveNode/,
    "\nfunction moveNode",
    "remove attachment-only helpers",
  );
  next = replaceOne(
    next,
    /\nfunction openInNewTab\(url\) \{[\s\S]*?\n\}\n/,
    "\n",
    "remove attachment opener",
  );
  next = replaceOne(
    next,
    '  openUrl = "",\n',
    "",
    "remove attachment shell property",
  );
  next = replaceOne(
    next,
    /\n          \{openUrl && \([\s\S]*?\n          \)\}/,
    "",
    "remove attachment open control",
  );
  next = replaceOne(
    next,
    /\nfunction AttachmentCardView\(props\) \{[\s\S]*?\n\}\n\nexport const WeddingImage/,
    "\nexport const WeddingImage",
    "remove attachment card view",
  );
  next = replaceOne(
    next,
    /\nexport const AttachmentCard = Node\.create\([\s\S]*$/,
    "\n",
    "remove attachment card node",
  );
  return next;
});

await edit("artifacts/memories-album/src/client/rich-text-formatting.css", (source) =>
  replaceOne(
    source,
    /\n\.tiptap-attachment-node \.tiptap-media-content,[\s\S]*?\n\.process-attachment-meta \{[\s\S]*?\n\}\n/,
    "\n",
    "remove attachment card presentation",
  ),
);

await edit("artifacts/memories-album/src/client/rich-text-media-editor.css", (source) => {
  let next = replaceOne(
    source,
    /\n\.tiptap-attachment-preview \{[\s\S]*?\n\.tiptap-attachment-preview \.process-attachment-meta \{[\s\S]*?\n\}\n/,
    "\n",
    "remove desktop attachment preview styles",
  );
  next = replaceOne(
    next,
    /\n  \.tiptap-attachment-preview \{[\s\S]*?\n  \.tiptap-attachment-preview \.process-attachment-meta \{[\s\S]*?\n  \}\n/,
    "\n",
    "remove mobile attachment preview styles",
  );
  return next;
});

await edit("artifacts/memories-album/src/server/process-content/api.mjs", (source) => {
  let next = replaceOne(
    source,
    /const ALLOWED_MIME_TYPES = new Set\(\[[\s\S]*?\]\);/,
    `const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);`,
    "restrict server MIME types",
  );
  next = replaceOne(
    next,
    /const ALLOWED_EXTENSIONS = new Set\(\[[\s\S]*?\]\);/,
    `const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "docx",
]);`,
    "restrict server extensions",
  );
  return next;
});

await edit("artifacts/memories-album/package.json", (source) => {
  const packageJson = JSON.parse(source);
  packageJson.scripts["test:layout-browser"] = "node scripts/verify-navigation-layout.mjs";
  delete packageJson.dependencies["@aiden0z/pptx-renderer"];
  delete packageJson.dependencies["pdfjs-dist"];
  return `${JSON.stringify(packageJson, null, 2)}\n`;
});

await edit("artifacts/memories-album/scripts/ensure-build-dependencies.mjs", (source) => {
  let next = replaceOne(
    source,
    /const requiredPackages = \[[\s\S]*?\];/,
    'const requiredPackages = ["mammoth", "docx-preview"];',
    "Word-only build dependencies",
  );
  next = replaceOne(
    next,
    'console.log("[Memories build] Document import dependencies are available.");',
    'console.log("[Memories build] Word import dependencies are available.");',
    "Word-only build message",
  );
  return next;
});

await writeFile(
  "artifacts/memories-album/test/document-import-direct-upload.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const driveUrl = new URL("../src/server/storage/drive-adapter.mjs", import.meta.url);
const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const proxyUrl = new URL("../src/server/storage/replit-drive.mjs", import.meta.url);

test("editor exposes Word-only import and image-only upload controls", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /label=\\{importingWord \\? "匯入中" : "匯入 Word"\\}/);
  assert.match(editor, /accept=\\{WORD_IMPORT_ACCEPT\\}/);
  assert.match(editor, /label=\\{uploading \\? "上傳中" : "加入圖片"\\}/);
  assert.match(editor, /accept=\\{IMAGE_UPLOAD_ACCEPT\\}/);
  assert.match(editor, /IMAGE_UPLOAD_MIME_TYPES/);
  for (const forbidden of ["application/pdf", ".ppt", ".pptx", ".xlsx", ".zip"]) {
    assert.equal(editor.includes(forbidden), false);
  }
  assert.equal(editor.includes("PageDocument"), false);
  assert.equal(editor.includes("AttachmentCard"), false);
});

test("server accepts only supported images and DOCX for Word fidelity storage", async () => {
  const api = await readFile(apiUrl, "utf8");
  for (const allowed of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]) {
    assert.equal(api.includes(allowed), true);
  }
  for (const forbidden of [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
  ]) {
    assert.equal(api.includes(forbidden), false);
  }
});

test("image and Word source files use one direct multipart request without chunks", async () => {
  const [drive, api, proxy] = await Promise.all([
    readFile(driveUrl, "utf8"),
    readFile(apiUrl, "utf8"),
    readFile(proxyUrl, "utf8"),
  ]);
  const start = drive.indexOf("async uploadAttachment(");
  const end = drive.indexOf("async uploadThumbnail(", start);
  const method = start >= 0 && end > start ? drive.slice(start, end) : "";
  assert.match(method, /#uploadMultipart\\(/);
  assert.doesNotMatch(method, /#uploadResumable|Content-Range|RESUMABLE_CHUNK_BYTES/);
  assert.match(api, /const uploaded = await drive\\.uploadAttachment\\(\\{/);
  assert.match(proxy, /"attachment-upload"/);
});
`,
);

await writeFile(
  "artifacts/memories-album/test/document-import-button-label.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("the toolbar exposes exactly one Word import control", async () => {
  const source = await readFile(editorUrl, "utf8");
  const labels = source.match(/label=\\{[^\\n]*"匯入 Word"[^\\n]*\\}/g) || [];
  assert.equal(labels.length, 1);
  assert.doesNotMatch(source, /"匯入文件"/);
  assert.doesNotMatch(source, /匯入 PDF|匯入 PPT|PowerPoint/);
});
`,
);

await writeFile(
  "artifacts/memories-album/test/rich-text-formatting-ui.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const mediaUrl = new URL("../src/client/TiptapMediaNodes.jsx", import.meta.url);
const contentUrl = new URL("../src/client/ProcessRichContent.jsx", import.meta.url);
const stylesUrl = new URL("../src/client/rich-text-formatting.css", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("article editor uses the open-source Tiptap React stack instead of execCommand", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  for (const signal of ["useEditor", "EditorContent", "BubbleMenu", "StarterKit", "TextAlign", "Placeholder"]) {
    assert.match(editor, new RegExp(signal));
  }
  assert.doesNotMatch(editor, /document\\.execCommand/);
  for (const dependency of [
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-text-align",
    "@tiptap/extension-placeholder",
  ]) {
    assert.ok(packageJson.dependencies[dependency]);
  }
});

test("Tiptap toolbar exposes baseline formatting and paragraph alignment", async () => {
  const editor = await readFile(editorUrl, "utf8");
  for (const command of [
    "toggleBold", "toggleItalic", "toggleUnderline", "toggleStrike", "setTextAlign",
    "toggleBulletList", "toggleOrderedList", "liftListItem", "sinkListItem",
    "setLink", "unsetLink", "undo", "redo", "unsetAllMarks", "clearNodes",
  ]) {
    assert.match(editor, new RegExp(command));
  }
  assert.match(editor, /左右等寬/);
});

test("only uploaded images become movable media nodes", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /type: "weddingImage"/);
  assert.match(editor, /attachment\\?\\.isImage/);
  assert.match(editor, /加入圖片/);
  assert.doesNotMatch(editor, /type: "attachmentCard"|加入圖片或附件|PageDocument/);
});

test("image nodes support drag reorder and resizing", async () => {
  const media = await readFile(mediaUrl, "utf8");
  assert.match(media, /name: "weddingImage"[\\s\\S]*draggable: true/);
  assert.doesNotMatch(media, /name: "attachmentCard"|AttachmentCardView|tiptap-attachment-preview/);
  assert.match(media, /data-drag-handle/);
  assert.match(media, /onPointerDown=\\{startResize\\}/);
  assert.match(media, /type="range"/);
  for (const destination of ["first", "previous", "next", "last"]) {
    assert.match(media, new RegExp(\`moveNode\\\\(editor, getPos, "\${destination}"\\\\)\`));
  }
});

test("public content preserves controlled image width and Word fidelity blocks", async () => {
  const [content, styles] = await Promise.all([
    readFile(contentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(content, /SAFE_TEXT_ALIGNMENTS/);
  assert.match(content, /safeMediaWidth/);
  assert.match(content, /process-word-document/);
  assert.doesNotMatch(content, /process-page-document|pageDocumentKind|renderPageDocumentFromUrl/);
  assert.match(styles, /\\.process-rich-content \\.process-inline-image/);
  assert.doesNotMatch(styles, /tiptap-attachment-node/);
});
`,
);

await writeFile(
  "artifacts/memories-album/test/media-editor-filename-mobile.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recoverUtf8Filename } from "../src/filename-encoding.mjs";

const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const mediaUrl = new URL("../src/client/TiptapMediaNodes.jsx", import.meta.url);
const mediaStylesUrl = new URL("../src/client/rich-text-media-editor.css", import.meta.url);
const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("Chinese image filenames are recovered from legacy latin1 mojibake", () => {
  assert.equal(recoverUtf8Filename("å©ç¦®ç§ç.jpg"), "婚禮照片.jpg");
  assert.equal(recoverUtf8Filename("café.png"), "café.png");
});

test("multipart uploads decode filename parameters as UTF-8", async () => {
  const api = await readFile(apiUrl, "utf8");
  assert.match(api, /defParamCharset: "utf8"/);
  assert.match(api, /recoverUtf8Filename/);
});

test("mobile image editor uses move controls instead of touch drag and resize handles", async () => {
  const media = await readFile(mediaUrl, "utf8");
  const styles = await readFile(mediaStylesUrl, "utf8");
  for (const destination of ["first", "previous", "next", "last"]) {
    assert.match(media, new RegExp(\`moveNode\\\\(editor, getPos, "\${destination}"\\\\)\`));
  }
  assert.doesNotMatch(media, /tiptap-attachment-preview|openInNewTab/);
  assert.match(styles, /@media \\(max-width: 720px\\), \\(pointer: coarse\\)/);
  assert.match(styles, /width: 100% !important/);
  assert.match(styles, /\\[data-desktop-drag-handle\\][\\s\\S]*display: none/);
  assert.match(styles, /\\.tiptap-media-resize-handle[\\s\\S]*display: none !important/);
});

test("editor explains Word-only import and image-only upload", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /手機請點選圖片後使用移動與寬度控制/);
  assert.match(editor, /「匯入 Word」只接受 \\.docx/);
  assert.match(editor, /「加入圖片」只接受 JPG、PNG、WebP 或 GIF/);
  assert.doesNotMatch(editor, /PDF|PowerPoint|加入圖片或附件/);
});
`,
);

await edit("artifacts/memories-album/test/word-import-ui.test.mjs", (source) => {
  let next = source.replace(/assert\.match\(editor, \/匯入文件\/\);/, 'assert.match(editor, /匯入 Word/);');
  next = next.replace(
    /assert\.match\(editor, \/accept=\\\{DOCUMENT_IMPORT_ACCEPT\\\}\/\);/,
    'assert.match(editor, /accept=\\{WORD_IMPORT_ACCEPT\\}/);',
  );
  next = next.replace(
    /  assert\.match\(editor, \/Word 會自動判斷可編輯或保真模式\/\);\n  assert\.match\(editor, \/PDF 與 PowerPoint 會在游標位置\/\);/,
    '  assert.match(editor, /只接受 \\.docx/);\n  assert.doesNotMatch(editor, /PDF|PowerPoint/);',
  );
  return next;
});

await edit("artifacts/memories-album/test/build-dependencies.test.mjs", (source) => {
  let next = source.replace(
    /for \(const dependency of \[[\s\S]*?\]\) \{/,
    'for (const dependency of ["mammoth", "docx-preview"]) {',
  );
  next = next.replace(
    /test\("Memories build checks locked document dependencies before Vite starts"/,
    'test("Memories build checks locked Word dependencies before Vite starts"',
  );
  return next;
});

await writeFile(
  "docs/memories/word-import-image-upload-2026-08-03.md",
  `# Word import and image upload scope\n\nDate: 2026-08-03\n\n## Editor controls\n\n- **匯入 Word** accepts only \`.docx\`.\n- **加入圖片** accepts only JPEG, PNG, WebP, and GIF.\n- PDF, PPT, PPTX, Excel, text, ZIP, and generic attachment-card creation were removed.\n\nThe controls remain in their existing toolbar positions. No layout, spacing, typography, color, size, or DOM order was changed.\n\n## Word behavior\n\nDOCX files continue to use the existing conditional importer:\n\n- ordinary content becomes editable rich text\n- documents with tables, pages, headers, footers, advanced typography, or positioned objects use the Word fidelity block\n- embedded Word images use the same image storage endpoint\n- a fidelity block retains the original DOCX source\n\n## Storage boundary\n\nThe process-content upload endpoint accepts only supported image formats and DOCX. It continues to use one Google Drive multipart request without a resumable session, Content-Range, or chunk splitting.\n\n## Removed implementation\n\n- PDF.js and the PDF page renderer\n- PowerPoint PPTX renderer and legacy PPT viewer\n- page-document Tiptap node and public hydration\n- generic attachment-card Tiptap node and creation controls\n- PDF/PPT browser geometry test and associated dependencies\n`,
);

for (const path of [
  "artifacts/memories-album/src/client/TiptapPageDocumentNode.jsx",
  "artifacts/memories-album/src/client/page-document.mjs",
  "artifacts/memories-album/src/client/page-document.css",
  "artifacts/memories-album/scripts/verify-page-document-layout.mjs",
  "artifacts/memories-album/test/page-document-import.test.mjs",
  "docs/memories/document-import-direct-upload-2026-08-03.md",
]) {
  await rm(path, { force: true });
}

console.log("Applied Word-only import and image-only upload cleanup.");
