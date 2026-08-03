# Tiptap image parser undefined-reference incident

> **Status:** Resolved  
> **Detected:** 2026-08-04T00:06:00+08:00（Asia/Taipei）  
> **Affected surface:** `/Memories/admin` → 婚禮流程分類與影片／rich-content editor  
> **Error:** `ReferenceError: readImageAttributes is not defined`

## User-visible symptom

Opening the administrator area that mounts the wedding-process rich-text editor caused the React error boundary to replace the normal interface. The browser stack pointed to Tiptap schema initialization:

```text
ReferenceError: readImageAttributes is not defined
    at Object.parseHTML (...)
    at ...createExtensionManager
    at ...createEditor
```

This was a browser runtime failure, not an API, PostgreSQL, Google Drive, category-loading, or video-loading failure. The crash happened when Tiptap created the editor and registered or invoked the retained image node's HTML parser.

## Root cause

PR #173, **Restrict editor to Word imports and image uploads**, intentionally removed the generic attachment-card feature from `TiptapMediaNodes.jsx`.

The cleanup deleted one contiguous helper block containing all of the following:

- attachment formatting helpers;
- attachment attribute parsing;
- **the still-required `readImageAttributes` parser for `WeddingImage`**.

The attachment node itself was removed correctly, but the retained `WeddingImage.parseHTML()` implementation still contained:

```js
{ tag: "figure.process-inline-image", getAttrs: readImageAttributes }
{ tag: "img[src]", getAttrs: readImageAttributes }
```

The result was a dangling JavaScript identifier. The failure remained dormant until the rich-text editor was instantiated in a browser.

## Why existing checks did not catch it

The checks used for the cleanup confirmed that:

- the attachment node and unsupported document features were gone;
- the wedding-image node still existed;
- the production bundle could be generated;
- the server health endpoint responded.

They did **not** assert that every `parseHTML().getAttrs` callback still had a declaration or import.

A production build can bundle a free JavaScript identifier without executing that callback. The server health smoke test also does not create a browser editor. Therefore both checks could pass while the administrator editor still crashed at runtime.

## Fix

The retained `readImageAttributes(element)` helper was restored before `WeddingImage` schema creation. It now safely reads:

- a standalone `<img>` or an `<img>` inside `figure.process-inline-image`;
- `src` and `alt`;
- optional `<figcaption>` text;
- width from `data-width` or inline style;
- a clamped fallback width through `clampMediaWidth()`.

No editor layout, spacing, font, dimensions, colors, DOM order, API, database, Google Drive data, migration, or Production configuration was changed.

## Regression protection

A focused test now scans every `getAttrs: callbackName` registration in `TiptapMediaNodes.jsx` and fails when the callback has no declaration or import before schema creation.

The test also preserves the retained wedding-image parser contract:

- both `figure.process-inline-image` and standalone `img[src]` use `readImageAttributes`;
- image, caption, width, and clamping logic remain present.

This directly covers the dependency that the cleanup accidentally removed.

## Prevention rules

### When deleting an editor node or attachment type

1. Search for every declaration **and every reference** before deleting a helper block.
2. Classify each helper as removed-feature-only or shared with a retained node.
3. Avoid deleting adjacent functions as one visual block unless every function has been dependency-checked.
4. Add negative tests proving removed features are absent **and positive tests proving retained features still initialize**.
5. Treat Tiptap `parseHTML`, `renderHTML`, command callbacks, node views, and extension configuration as executable dependency graphs, not passive configuration text.

### Required validation for Tiptap schema changes

1. Run the focused schema-callback regression tests.
2. Run the complete Standalone Memories Node suite.
3. Build the production client and server.
4. Open the administrator process editor in a real browser.
5. Expand at least one wedding-process category containing rich text, image content, and video configuration.
6. Fail validation on any browser `ReferenceError`, `pageerror`, console error, ErrorBoundary fallback, or missing editor.

### Review rule

A cleanup that removes one media/document type is incomplete until every retained Tiptap node has explicit positive coverage for:

- extension registration;
- parser callback availability;
- editor initialization;
- retained serialization/parsing behavior.

## Related files

- `artifacts/memories-album/src/client/TiptapMediaNodes.jsx`
- `artifacts/memories-album/src/client/RichTextEditor.jsx`
- `artifacts/memories-album/test/tiptap-image-parser-reference.test.mjs`
- `artifacts/memories-album/test/rich-text-formatting-ui.test.mjs`
- PR #173: cleanup that introduced the dangling reference
