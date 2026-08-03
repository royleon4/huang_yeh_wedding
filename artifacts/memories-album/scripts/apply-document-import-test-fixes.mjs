import { readFile, writeFile } from "node:fs/promises";

async function replace(path, search, replacement, label) {
  const source = await readFile(path, "utf8");
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  await writeFile(path, source.replace(search, replacement));
}

await replace(
  "artifacts/memories-album/test/document-import-direct-upload.test.mjs",
  "  assert.match(editor, /const DOCUMENT_IMPORT_ACCEPT = [/);",
  "  assert.match(editor, /const DOCUMENT_IMPORT_ACCEPT = \\[/);",
  "valid document accept regex",
);

await replace(
  "artifacts/memories-album/test/page-document-import.test.mjs",
  "  assert.match(editor, /PDF 與 PowerPoint 上傳後/);",
  "  assert.match(editor, /PDF 與 PowerPoint 會在游標位置/);",
  "page document hint assertion",
);

await replace(
  "artifacts/memories-album/test/word-import-ui.test.mjs",
  `  assert.match(editor, /匯入 Word/);
  assert.match(editor, /accept=\\{WORD_IMPORT_ACCEPT\\}/);`,
  `  assert.match(editor, /匯入文件/);
  assert.match(editor, /accept=\\{DOCUMENT_IMPORT_ACCEPT\\}/);`,
  "unified Word toolbar assertions",
);

await replace(
  "artifacts/memories-album/test/word-import-ui.test.mjs",
  `  assert.match(editor, /一般文件轉成可編輯內容/);
  assert.match(editor, /保真文件區塊/);`,
  `  assert.match(editor, /Word 會自動判斷可編輯或保真模式/);
  assert.match(editor, /PDF 與 PowerPoint 會在游標位置/);`,
  "unified document hint assertions",
);

await replace(
  "artifacts/memories-album/src/server/storage/drive-adapter.mjs",
  `      description: "Memories process content attachment",
      appProperties,`,
  `      description: "Memories process content attachment",
      appProperties,
      diagnosticKind: "attachment",`,
  "attachment diagnostic kind",
);

await replace(
  "artifacts/memories-album/src/server/storage/drive-adapter.mjs",
  `    description,
    appProperties = {},
  }) {`,
  `    description,
    appProperties = {},
    diagnosticKind = "thumbnail",
  }) {`,
  "multipart diagnostic parameter",
);

await replace(
  "artifacts/memories-album/src/server/storage/drive-adapter.mjs",
  `        headers: {
          "Content-Type": \`multipart/related; boundary=\${boundary}\`,
        },`,
  `        headers: {
          "Content-Type": \`multipart/related; boundary=\${boundary}\`,
          "X-Memories-Upload-Kind": diagnosticKind,
        },`,
  "multipart diagnostic header",
);

await replace(
  "artifacts/memories-album/src/server/storage/replit-drive.mjs",
  `  if (options.method === "POST" && requestPath.includes("uploadType=multipart")) {
    return "multipart-upload";
  }`,
  `  if (options.method === "POST" && requestPath.includes("uploadType=multipart")) {
    const uploadKind =
      options.headers?.["X-Memories-Upload-Kind"] ??
      options.headers?.["x-memories-upload-kind"];
    return uploadKind === "attachment" ? "attachment-upload" : "thumbnail-upload";
  }`,
  "multipart diagnostic classification",
);

await replace(
  "artifacts/memories-album/src/server/storage/replit-drive.mjs",
  `  return async function replitDriveProxy(connector, path, options = {}) {
    const response = await connectors.proxy(connector, path, options);
    const stage = requestStage(path, options);`,
  `  return async function replitDriveProxy(connector, path, options = {}) {
    const stage = requestStage(path, options);
    const forwardedHeaders = { ...(options.headers ?? {}) };
    delete forwardedHeaders["X-Memories-Upload-Kind"];
    delete forwardedHeaders["x-memories-upload-kind"];
    const response = await connectors.proxy(connector, path, {
      ...options,
      headers: forwardedHeaders,
    });`,
  "strip internal diagnostic header",
);

await replace(
  "artifacts/memories-album/test/document-import-direct-upload.test.mjs",
  "  assert.match(proxy, /return \"multipart-upload\"/);",
  "  assert.match(proxy, /return uploadKind === \"attachment\" \? \"attachment-upload\" : \"thumbnail-upload\"/);",
  "attachment diagnostic assertion",
);

await replace(
  "docs/memories/document-import-direct-upload-2026-08-03.md",
  "Google Drive multipart failures are logged as `multipart-upload` rather than `thumbnail-upload`.",
  "Process-content multipart failures are logged as `attachment-upload`; thumbnail failures remain `thumbnail-upload`.",
  "diagnostic documentation",
);

console.log("Updated unified document import tests and multipart diagnostics.");
