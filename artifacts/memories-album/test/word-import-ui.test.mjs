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

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const importerUrl = new URL("../src/client/word-import.mjs", import.meta.url);
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

test("Word import result describes images and conversion warnings", () => {
  assert.equal(
    describeWordImport({
      fileName: "流程.docx",
      importedImages: 2,
      skippedImages: 1,
      warningCount: 3,
    }),
    "已從「流程.docx」匯入游標位置（2 張圖片已上傳、1 張圖片未匯入、3 項格式提示）。",
  );
});

test("admin toolbar imports DOCX at the cursor without replacing attachment upload", async () => {
  const [editor, importer, packageJson] = await Promise.all([
    readFile(editorUrl, "utf8"),
    readFile(importerUrl, "utf8"),
    readFile(packageUrl, "utf8").then(JSON.parse),
  ]);

  assert.equal(packageJson.dependencies.mammoth, "1.12.0");
  assert.match(editor, /wordInputRef/);
  assert.match(editor, /匯入 Word/);
  assert.match(editor, /accept=\{WORD_IMPORT_ACCEPT\}/);
  assert.match(editor, /convertWordFileToHtml/);
  assert.match(editor, /insertContent\(`\$\{result\.html\}<p><\/p>`\)/);
  assert.match(editor, /加入圖片或附件/);
  assert.match(editor, /內容會插入目前游標位置/);

  assert.match(importer, /await import\("mammoth"\)/);
  assert.match(importer, /externalFileAccess: false/);
  assert.match(importer, /image\.readAsArrayBuffer\(\)/);
  assert.match(importer, /uploadImage\(imageFile\)/);
});

test("converted Word HTML is allowlisted before Tiptap receives it", async () => {
  const importer = await readFile(importerUrl, "utf8");

  assert.match(importer, /new DOMParser\(\)/);
  assert.match(importer, /const ALLOWED_TAGS = new Set/);
  assert.match(importer, /flattenTable/);
  assert.match(importer, /safeImportedUrl/);
  assert.match(importer, /noopener noreferrer/);
  assert.match(importer, /if \(!ALLOWED_TAGS\.has\(current\.tagName\)\)/);
  assert.doesNotMatch(importer, /dangerouslySetInnerHTML/);
});
