import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change produced for ${path}`);
  await writeFile(path, after);
}

function replaceOnce(source, search, replacement, label) {
  const matches = typeof search === "string"
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, `${search.flags.includes("g") ? search.flags : `${search.flags}g`}`))].length;
  if (matches !== 1) throw new Error(`${label}: expected one match, found ${matches}`);
  return source.replace(search, replacement);
}

await edit("artifacts/memories-album/src/client/RichTextEditor.jsx", (source) => {
  let next = replaceOnce(
    source,
    /const ATTACHMENT_ACCEPT = \[[\s\S]*?\]\.join\(","\);/,
    `const DOCUMENT_IMPORT_ACCEPT = [
  WORD_IMPORT_ACCEPT,
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf",
  ".ppt",
  ".pptx",
].join(",");

const ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  ".doc",
  ".xls",
  ".xlsx",
  "text/plain",
  ".zip",
].join(",");`,
    "document accept lists",
  );

  next = replaceOnce(
    next,
    "\n  const setBlock = (value) => {",
    `
  const importDocument = async (file) => {
    if (!file) return;
    const kind = pageDocumentKind({ name: file.name, mimeType: file.type });
    if (kind) {
      await upload(file);
      if (wordInputRef.current) wordInputRef.current.value = "";
      return;
    }
    await importWord(file);
  };

  const setBlock = (value) => {`,
    "unified document importer",
  );

  next = replaceOnce(
    next,
    /          <ToolbarButton\n            label=\{importingWord \? "匯入中" : "匯入 Word"\}[\s\S]*?onChange=\{\(event\) => void importWord\(event\.target\.files\?\.\[0\] \?\? null\)\}\n          \/>/,
    `          <ToolbarButton
            label={importingWord || uploading ? "匯入中" : "匯入文件"}
            icon={importingWord || uploading ? "…" : "檔"}
            wide
            disabled={disabled || importingWord || uploading || !editor}
            onClick={() => wordInputRef.current?.click()}
          />
          <input
            ref={wordInputRef}
            className="process-rich-file-input"
            type="file"
            accept={DOCUMENT_IMPORT_ACCEPT}
            disabled={disabled || importingWord || uploading}
            onChange={(event) => void importDocument(event.target.files?.[0] ?? null)}
          />`,
    "document import toolbar",
  );

  next = replaceOnce(
    next,
    "Word 匯入會自動判斷：一般文件轉成可編輯內容；含分頁、字型、表格、頁首頁尾、註腳或定位物件時，改用不干擾網站版面的保真文件區塊。PDF 與 PowerPoint 上傳後會在游標位置插入保留原頁面或投影片配置的文件區塊。",
    "「匯入文件」支援 .docx、.pdf、.ppt 與 .pptx。Word 會自動判斷可編輯或保真模式；PDF 與 PowerPoint 會在游標位置插入保留原頁面或投影片配置的文件區塊。",
    "document import hint",
  );
  return next;
});

await edit("artifacts/memories-album/src/server/storage/drive-adapter.mjs", (source) =>
  replaceOnce(
    source,
    "\n  async uploadThumbnail({",
    `
  async uploadAttachment({
    bytes,
    filename,
    contentType,
    parentId = null,
    appProperties = {},
  }) {
    const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
    if (body.length === 0) {
      throw new DriveConnectorError(400, "DRIVE_REQUEST_FAILED");
    }
    return this.#uploadMultipart({
      bytes: body,
      filename,
      contentType,
      folderId: parentId ?? this.originalFolderId,
      description: "Memories process content attachment",
      appProperties,
    });
  }

  async uploadThumbnail({`,
    "direct multipart attachment method",
  ),
);

await edit("artifacts/memories-album/src/server/process-content/api.mjs", (source) =>
  replaceOnce(
    source,
    "        const uploaded = await drive.uploadOriginal({",
    "        const uploaded = await drive.uploadAttachment({",
    "process attachment direct upload",
  ),
);

await edit("artifacts/memories-album/src/server/storage/replit-drive.mjs", (source) =>
  replaceOnce(
    source,
    '    return "thumbnail-upload";',
    '    return "multipart-upload";',
    "multipart diagnostic stage",
  ),
);

await edit("artifacts/memories-album/src/client/admin-client.mjs", (source) =>
  replaceOnce(
    source,
    '  if (error?.status === 503) return "管理服務暫時無法使用，請稍後再試。";',
    `  if (error?.code === "DRIVE_AUTHORIZATION_REQUIRED") {
    return "Google Drive 拒絕直接上傳（403）。這次附件上傳未使用分段上傳；請重新授權 Google Drive，並確認「00 未分類」資料夾可寫入。";
  }
  if (error?.status === 503) return "管理服務暫時無法使用，請稍後再試。";`,
    "Drive authorization message",
  ),
);

await writeFile(
  "artifacts/memories-album/test/document-import-direct-upload.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const driveUrl = new URL("../src/server/storage/drive-adapter.mjs", import.meta.url);
const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const proxyUrl = new URL("../src/server/storage/replit-drive.mjs", import.meta.url);
const adminClientUrl = new URL("../src/client/admin-client.mjs", import.meta.url);

test("Word PDF and PowerPoint share one document import control", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /const DOCUMENT_IMPORT_ACCEPT = \[/);
  for (const extension of [".docx", ".pdf", ".ppt", ".pptx"]) {
    assert.ok(editor.includes(extension));
  }
  assert.match(editor, /label=\{importingWord \|\| uploading \? "匯入中" : "匯入文件"\}/);
  assert.match(editor, /accept=\{DOCUMENT_IMPORT_ACCEPT\}/);
  assert.match(editor, /importDocument\(event\.target\.files\?\.\[0\]/);
  assert.match(editor, /pageDocumentKind\(\{ name: file\.name, mimeType: file\.type \}\)/);
  assert.doesNotMatch(editor, /label=\{importingWord \? "匯入中" : "匯入 Word"\}/);
});

test("generic attachment selector no longer duplicates document import formats", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const generic = editor.match(/const ATTACHMENT_ACCEPT = \[([\s\S]*?)\]\.join\(","\);/)?.[1] || "";
  for (const extension of [".docx", ".pdf", ".ppt", ".pptx"]) {
    assert.equal(generic.includes(extension), false);
  }
});

test("process content attachments use one direct multipart request without resumable chunks", async () => {
  const [drive, api, proxy] = await Promise.all([
    readFile(driveUrl, "utf8"),
    readFile(apiUrl, "utf8"),
    readFile(proxyUrl, "utf8"),
  ]);
  const attachmentMethod = drive.match(/async uploadAttachment\([\s\S]*?\n  }\n\n  async uploadThumbnail/)?.[0] || "";
  assert.match(attachmentMethod, /#uploadMultipart\(/);
  assert.doesNotMatch(attachmentMethod, /#uploadResumable|Content-Range|RESUMABLE_CHUNK_BYTES/);
  assert.match(api, /const uploaded = await drive\.uploadAttachment\(\{/);
  assert.doesNotMatch(api, /const uploaded = await drive\.uploadOriginal\(\{/);
  assert.match(proxy, /return "multipart-upload"/);
});

test("Drive 403 error states that direct upload did not use chunks", async () => {
  const adminClient = await readFile(adminClientUrl, "utf8");
  assert.match(adminClient, /DRIVE_AUTHORIZATION_REQUIRED/);
  assert.match(adminClient, /未使用分段上傳/);
});
`,
);

console.log("Applied unified document import and direct multipart attachment upload changes.");
