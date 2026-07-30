import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, search, replacement, label) {
  const source = await readFile(path, "utf8");
  if (!source.includes(search)) {
    throw new Error(`Could not find ${label} in ${path}`);
  }
  await writeFile(path, source.replace(search, replacement));
}

const root = new URL("../", import.meta.url);
const apiPath = new URL("src/server/process-content/api.mjs", root);
const editorPath = new URL("src/client/RichTextEditor.jsx", root);
const uiTestPath = new URL("test/rich-text-formatting-ui.test.mjs", root);

await replaceOnce(
  apiPath,
  'import { Readable } from "node:stream";\n',
  'import { Readable } from "node:stream";\nimport { recoverUtf8Filename } from "../../filename-encoding.mjs";\n',
  "filename recovery import",
);

await replaceOnce(
  apiPath,
  '  const value = String(filename || "attachment")\n',
  '  const value = String(recoverUtf8Filename(filename) || "attachment")\n',
  "safe filename recovery",
);

await replaceOnce(
  apiPath,
  '    name: attachment.originalFilename,\n',
  '    name: recoverUtf8Filename(attachment.originalFilename),\n',
  "attachment payload filename",
);

await replaceOnce(
  apiPath,
  '        headers: request.headers,\n        limits: { files: 1, fields: 0, fileSize: MAX_ATTACHMENT_BYTES },\n',
  '        headers: request.headers,\n        defParamCharset: "utf8",\n        limits: { files: 1, fields: 0, fileSize: MAX_ATTACHMENT_BYTES },\n',
  "Busboy UTF-8 filename decoding",
);

await replaceOnce(
  apiPath,
  '  const encodedName = encodeURIComponent(attachment.originalFilename);\n',
  '  const encodedName = encodeURIComponent(recoverUtf8Filename(attachment.originalFilename));\n',
  "download filename recovery",
);

await replaceOnce(
  editorPath,
  'import "./rich-text-mobile.css";\n',
  'import "./rich-text-mobile.css";\nimport "./rich-text-media-editor.css";\n',
  "media editor stylesheet import",
);

await replaceOnce(
  editorPath,
  '            byteSize: Number(attachment.byteSize || 0),\n            width: 100,\n',
  '            byteSize: Number(attachment.byteSize || 0),\n            width: 82,\n',
  "compact attachment default width",
);

await replaceOnce(
  editorPath,
  '        反白文字可快速套用格式。圖片與附件可按住 ⠿ 拖曳位置，或使用上下鍵；拉動右側把手或寬度滑桿即可調整大小。\n',
  '        反白文字可快速套用格式。手機請點選圖片或附件後使用移動與寬度控制；桌面仍可拖曳，並可拉動把手調整大小。\n',
  "mobile media usage hint",
);

await replaceOnce(
  uiTestPath,
  '  assert.match(media, /moveNode\\(editor, getPos, -1\\)/);\n  assert.match(media, /moveNode\\(editor, getPos, 1\\)/);\n',
  '  for (const destination of ["first", "previous", "next", "last"]) {\n    assert.match(media, new RegExp(`moveNode\\\\(editor, getPos, "${destination}"\\\\)`));\n  }\n',
  "media move control contracts",
);
