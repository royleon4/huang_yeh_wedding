import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change produced for ${path}`);
  await writeFile(path, after);
}

await edit(
  "artifacts/memories-album/test/rich-text-formatting-selection.test.mjs",
  (source) =>
    source.replace(
      "  assert.match(media, /p\\.process-attachment-line/);",
      "  assert.doesNotMatch(media, /AttachmentCard|process-attachment-line/);",
    ),
);

function removeRulesContaining(source, classNames) {
  const escaped = classNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const target = new RegExp(`(?:${escaped.join("|")})`);
  return source.replace(/(^|\n)([^@{}][^{}]*)\{([^{}]*)\}/g, (rule, prefix, selector) =>
    target.test(selector) ? prefix : rule,
  );
}

await edit("artifacts/memories-album/src/client/rich-text-formatting.css", (source) =>
  removeRulesContaining(source, [
    ".tiptap-attachment-node",
    ".process-attachment-card",
    ".process-attachment-icon",
    ".process-attachment-name",
    ".process-attachment-meta",
  ]),
);

await edit("artifacts/memories-album/src/client/rich-text-mobile.css", (source) => {
  let next = source
    .replace("  .tiptap-image-node img,\n  .tiptap-attachment-node,\n  .tiptap-attachment-node a,\n", "  .tiptap-image-node img,\n")
    .replace("  .tiptap-editor-frame .ProseMirror a,\n  .process-attachment-name,\n  .process-attachment-meta,\n", "  .tiptap-editor-frame .ProseMirror a,\n");
  return next;
});

await edit("artifacts/memories-album/src/client/ProcessRichContent.jsx", (source) => {
  let next = source;
  for (const className of [
    "process-attachment-line",
    "process-attachment-card",
    "process-attachment-icon",
    "process-attachment-name",
    "process-attachment-meta",
  ]) {
    next = next.replace(`  "${className}",\n`, "");
  }
  next = next.replace(
    `      const isSizedMedia =
        (child.tagName === "FIGURE" && classNames.includes("process-inline-image")) ||
        (child.tagName === "DIV" && classNames.includes("process-attachment-card"));`,
    `      const isSizedMedia =
        child.tagName === "FIGURE" && classNames.includes("process-inline-image");`,
  );
  return next;
});

for (const path of [
  "artifacts/memories-album/src/client/TiptapMediaNodes.jsx",
  "artifacts/memories-album/src/client/RichTextEditor.jsx",
  "artifacts/memories-album/src/client/ProcessRichContent.jsx",
  "artifacts/memories-album/src/client/rich-text-formatting.css",
  "artifacts/memories-album/src/client/rich-text-mobile.css",
  "artifacts/memories-album/src/client/rich-text-media-editor.css",
]) {
  const source = await readFile(path, "utf8");
  for (const forbidden of [
    "AttachmentCard",
    "attachmentCard",
    "PageDocument",
    "pageDocument",
    "process-page-document",
    "tiptap-attachment-node",
    "tiptap-attachment-preview",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${path} still contains removed feature token: ${forbidden}`);
    }
  }
}

console.log("Finished Word-only import and image-only upload cleanup.");
