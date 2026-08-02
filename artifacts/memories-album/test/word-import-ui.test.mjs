import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  describeWordImport,
  isSupportedWordImageType,
  validateWordImportFile,
  WORD_IMPORT_ACCEPT,
  WORD_IMPORT_MAX_BYTES,
  wordImageFilename,
} from "../src/client/word-import.mjs";
import { fidelityReasonText } from "../src/client/word-fidelity.mjs";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const importerUrl = new URL("../src/client/word-import.mjs", import.meta.url);
const fidelityUrl = new URL("../src/client/word-fidelity.mjs", import.meta.url);
const wordNodeUrl = new URL("../src/client/TiptapWordDocumentNode.jsx", import.meta.url);
const publicContentUrl = new URL("../src/client/ProcessRichContent.jsx", import.meta.url);
const wordStylesUrl = new URL("../src/client/word-document.css", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("Word importer accepts DOCX and rejects legacy or oversized files", () => {
  assert.match(WORD_IMPORT_ACCEPT, /\.docx/);
  assert.deepEqual(
    validateWordImportFile({
      name: "婚禮證道.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4096,
    }),
    {
      name: "婚禮證道.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4096,
    },
  );
  assert.throws(
    () => validateWordImportFile({ name: "舊文件.doc", type: "application/msword", size: 4096 }),
    /另存為 \.docx/,
  );
  assert.throws(
    () => validateWordImportFile({ name: "過大.docx", type: "", size: WORD_IMPORT_MAX_BYTES + 1 }),
    /超過 25 MB/,
  );
  assert.throws(
    () => validateWordImportFile({ name: "空白.docx", type: "", size: 0 }),
    /空的或無法讀取/,
  );
});

test("embedded Word images use supported attachment types and deterministic names", () => {
  assert.equal(isSupportedWordImageType("image/png"), true);
  assert.equal(isSupportedWordImageType("image/jpeg"), true);
  assert.equal(isSupportedWordImageType("image/tiff"), false);
  assert.equal(wordImageFilename(1, "image/png"), "word-image-01.png");
  assert.equal(wordImageFilename(12, "image/jpeg"), "word-image-12.jpg");
});

test("Word import messages distinguish editable and fidelity modes", () => {
  assert.equal(
    describeWordImport({
      mode: "editable",
      fileName: "流程.docx",
      importedImages: 2,
      skippedImages: 1,
      warningCount: 3,
    }),
    "已從「流程.docx」匯入可編輯內容至游標位置（2 張圖片已上傳、1 張圖片未匯入、3 項格式提示）。",
  );
  assert.equal(fidelityReasonText({ reasons: ["表格", "頁首"] }), "表格、頁首");
  assert.match(
    describeWordImport({
      mode: "fidelity",
      fileName: "程序單.docx",
      fidelity: { reasons: ["分頁", "Word 字型或字級樣式"] },
      importedImages: 0,
      skippedImages: 0,
      warningCount: 0,
    }),
    /條件式保真文件區塊.*分頁、Word 字型或字級樣式/,
  );
});

test("admin toolbar conditionally inserts editable HTML or a fidelity node", async () => {
  const [editor, importer, packageJson] = await Promise.all([
    readFile(editorUrl, "utf8"),
    readFile(importerUrl, "utf8"),
    readFile(packageUrl, "utf8").then(JSON.parse),
  ]);

  assert.equal(packageJson.dependencies.mammoth, "1.12.0");
  assert.equal(packageJson.dependencies["docx-preview"], "0.4.0");
  assert.match(editor, /WordDocument/);
  assert.match(editor, /wordInputRef/);
  assert.match(editor, /匯入 Word/);
  assert.match(editor, /accept=\{WORD_IMPORT_ACCEPT\}/);
  assert.match(editor, /uploadDocument: onUploadAttachment/);
  assert.match(editor, /result\.mode === "fidelity"/);
  assert.match(editor, /type: "wordDocument"/);
  assert.match(editor, /insertContent\(`\$\{result\.html\}<p><\/p>`\)/);
  assert.match(editor, /一般文件轉成可編輯內容/);
  assert.match(editor, /保真文件區塊/);

  assert.match(importer, /await import\("mammoth"\)/);
  assert.match(importer, /inspectWordFidelity/);
  assert.match(importer, /uploadDocument\(file\)/);
  assert.match(importer, /mode = "fidelity"/);
  assert.match(importer, /externalFileAccess: false/);
  assert.match(importer, /image\.readAsArrayBuffer\(\)/);
});

test("fidelity inspection covers page layout, typography, tables and references", async () => {
  const fidelity = await readFile(fidelityUrl, "utf8");

  assert.match(fidelity, /renderHeaders: true/);
  assert.match(fidelity, /renderFooters: true/);
  assert.match(fidelity, /renderFootnotes: true/);
  assert.match(fidelity, /renderEndnotes: true/);
  assert.match(fidelity, /ignoreFonts: false/);
  assert.match(fidelity, /breakPages: true/);
  for (const signal of [
    "tables",
    "headers",
    "footers",
    "footnotes",
    "endnotes",
    "drawings",
    "positioned",
    "columns",
    "pageBreaks",
    "advancedTypography",
    "advancedSpacing",
  ]) {
    assert.match(fidelity, new RegExp(signal));
  }
  assert.match(fidelity, /requiresFidelity: reasons\.length > 0/);
  assert.match(fidelity, /import\("docx-preview"\)/);
});

test("high-fidelity Word node preserves its source and can be removed or opened", async () => {
  const wordNode = await readFile(wordNodeUrl, "utf8");

  assert.match(wordNode, /name: "wordDocument"/);
  assert.match(wordNode, /atom: true/);
  assert.match(wordNode, /isolating: true/);
  assert.match(wordNode, /draggable: true/);
  assert.match(wordNode, /data-type": "word-document"/);
  assert.match(wordNode, /data-src/);
  assert.match(wordNode, /data-download-url/);
  assert.match(wordNode, /renderWordDocumentFromUrl/);
  assert.match(wordNode, /開啟原檔/);
  assert.match(wordNode, /從文章移除/);
});

test("public rich content sanitizes then hydrates Word documents without page overflow", async () => {
  const [publicContent, styles] = await Promise.all([
    readFile(publicContentUrl, "utf8"),
    readFile(wordStylesUrl, "utf8"),
  ]);

  assert.match(publicContent, /process-word-document/);
  assert.match(publicContent, /data-type", "word-document"/);
  assert.match(publicContent, /safeUrl\(attributeValue\("data-src"\)\)/);
  assert.match(publicContent, /renderWordDocumentFromUrl/);
  assert.match(publicContent, /AbortController/);
  assert.match(publicContent, /dangerouslySetInnerHTML/);

  assert.match(styles, /\.process-word-document\s*\{[\s\S]*max-width: 100%/);
  assert.match(styles, /contain: layout paint/);
  assert.match(styles, /\.process-word-document-preview\s*\{[\s\S]*overflow-x: auto/);
  assert.match(styles, /overscroll-behavior-inline: contain/);
  assert.match(styles, /-webkit-overflow-scrolling: touch/);
  assert.doesNotMatch(styles, /position:\s*(?:fixed|absolute)/);
});

test("converted editable Word HTML is allowlisted before Tiptap receives it", async () => {
  const importer = await readFile(importerUrl, "utf8");

  assert.match(importer, /new DOMParser\(\)/);
  assert.match(importer, /const ALLOWED_TAGS = new Set/);
  assert.match(importer, /flattenTable/);
  assert.match(importer, /safeImportedUrl/);
  assert.match(importer, /noopener noreferrer/);
  assert.match(importer, /if \(!ALLOWED_TAGS\.has\(current\.tagName\)\)/);
  assert.doesNotMatch(importer, /dangerouslySetInnerHTML/);
});
