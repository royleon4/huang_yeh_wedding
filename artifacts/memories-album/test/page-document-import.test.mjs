import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isPageDocumentAttachment,
  pageDocumentKind,
  pageDocumentLabel,
} from "../src/client/page-document.mjs";

const rendererUrl = new URL("../src/client/page-document.mjs", import.meta.url);
const nodeUrl = new URL("../src/client/TiptapPageDocumentNode.jsx", import.meta.url);
const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const publicContentUrl = new URL("../src/client/ProcessRichContent.jsx", import.meta.url);
const stylesUrl = new URL("../src/client/page-document.css", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("page document detection accepts PDF, PPTX and legacy PPT", () => {
  assert.equal(pageDocumentKind({ name: "程序單.pdf", mimeType: "" }), "pdf");
  assert.equal(
    pageDocumentKind({
      name: "簡報.bin",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }),
    "pptx",
  );
  assert.equal(pageDocumentKind({ name: "舊簡報.PPT", mimeType: "" }), "ppt");
  assert.equal(pageDocumentKind({ name: "資料.xlsx", mimeType: "" }), "");
  assert.equal(isPageDocumentAttachment({ name: "程序單.pdf" }), true);
  assert.equal(isPageDocumentAttachment({ name: "資料.zip" }), false);
  assert.equal(pageDocumentLabel("pdf"), "PDF 文件");
  assert.equal(pageDocumentLabel("pptx"), "PowerPoint 簡報");
});

test("PDF renderer uses PDF.js workers, lazy pages and accessible extracted text", async () => {
  const renderer = await readFile(rendererUrl, "utf8");

  assert.match(renderer, /import\("pdfjs-dist\/build\/pdf\.mjs"\)/);
  assert.match(renderer, /pdf\.worker\.min\.mjs\?url/);
  assert.match(renderer, /new IntersectionObserver/);
  assert.match(renderer, /page\.render\(\{ canvasContext: context, viewport \}\)/);
  assert.match(renderer, /page\.getTextContent\(\)/);
  assert.match(renderer, /process-page-document-text/);
  assert.match(renderer, /pixelRatio/);
  assert.match(renderer, /renderPage\(1\)/);
});

test("PPTX renderer uses security limits and windowed responsive slide rendering", async () => {
  const [renderer, packageJson] = await Promise.all([
    readFile(rendererUrl, "utf8"),
    readFile(packageUrl, "utf8").then(JSON.parse),
  ]);

  assert.equal(packageJson.dependencies["@aiden0z/pptx-renderer"], "1.2.4");
  assert.equal(packageJson.dependencies["pdfjs-dist"], "6.1.200");
  assert.match(renderer, /import\("@aiden0z\/pptx-renderer"\)/);
  assert.match(renderer, /PptxViewer\.open/);
  assert.match(renderer, /RECOMMENDED_ZIP_LIMITS/);
  assert.match(renderer, /renderMode: "list"/);
  assert.match(renderer, /fitMode: "contain"/);
  assert.match(renderer, /windowed: true/);
  assert.match(renderer, /viewer\.destroy\(\)/);
});

test("legacy PPT uses an isolated Office viewer and retains the original file", async () => {
  const renderer = await readFile(rendererUrl, "utf8");

  assert.match(renderer, /view\.officeapps\.live\.com\/op\/embed\.aspx/);
  assert.match(renderer, /encodeURIComponent/);
  assert.match(renderer, /process-page-document-office-frame/);
});

test("editor inserts page documents automatically without adding another toolbar control", async () => {
  const editor = await readFile(editorUrl, "utf8");

  assert.match(editor, /PageDocument/);
  assert.match(editor, /isPageDocumentAttachment/);
  assert.match(editor, /type: "pageDocument"/);
  assert.match(editor, /PDF 與 PowerPoint 上傳後/);
  assert.match(editor, /label=\{uploading \? "上傳中" : "加入圖片或附件"\}/);
  assert.doesNotMatch(editor, /匯入 PDF/);
  assert.doesNotMatch(editor, /匯入 PPT/);
});

test("page document node is atomic, draggable and keeps source metadata", async () => {
  const node = await readFile(nodeUrl, "utf8");

  assert.match(node, /name: "pageDocument"/);
  assert.match(node, /atom: true/);
  assert.match(node, /draggable: true/);
  assert.match(node, /isolating: true/);
  assert.match(node, /data-type": "page-document"/);
  assert.match(node, /data-document-kind/);
  assert.match(node, /data-download-url/);
  assert.match(node, /開啟原檔/);
  assert.match(node, /從文章移除/);
});

test("public content sanitizes and hydrates page document blocks", async () => {
  const publicContent = await readFile(publicContentUrl, "utf8");
  const allowedTags = publicContent.match(
    /const ALLOWED_TAGS = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1];

  assert.ok(allowedTags);
  assert.match(publicContent, /process-page-document/);
  assert.match(publicContent, /SAFE_PAGE_DOCUMENT_KINDS/);
  assert.match(publicContent, /data-type", "page-document"/);
  assert.match(publicContent, /renderPageDocumentFromUrl/);
  assert.match(publicContent, /usePageDocumentPreviews/);
  assert.match(publicContent, /AbortController/);
  assert.doesNotMatch(allowedTags, /"IFRAME"/);
  assert.match(publicContent, /\["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM"\]/);
});

test("page document layout remains contained inside the existing article column", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.process-page-document\s*\{[\s\S]*max-width: 100%/);
  assert.match(styles, /contain: layout paint/);
  assert.match(styles, /\.process-page-document-preview\s*\{[\s\S]*overflow: auto/);
  assert.match(styles, /max-height: min\(76vh, 56rem\)/);
  assert.match(styles, /\.process-page-document-pdf-canvas\s*\{[\s\S]*max-width: 100%/);
  assert.match(styles, /\.process-page-document-office-frame\s*\{[\s\S]*width: 100%/);
  assert.doesNotMatch(styles, /position:\s*(?:fixed|absolute)/);
});
