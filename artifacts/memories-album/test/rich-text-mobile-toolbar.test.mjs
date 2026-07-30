import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mobileStylesUrl = new URL("../src/client/rich-text-mobile.css", import.meta.url);
const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("mobile overrides load after the base rich text styles", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const baseIndex = editor.indexOf('import "./rich-text-formatting.css"');
  const mobileIndex = editor.indexOf('import "./rich-text-mobile.css"');

  assert.ok(baseIndex >= 0);
  assert.ok(mobileIndex > baseIndex);
});

test("standard phones use one horizontally scrollable toolbar row", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /\.tiptap-toolbar\s*\{[\s\S]*display: flex/);
  assert.match(styles, /flex-wrap: nowrap/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /overflow-y: hidden/);
  assert.match(styles, /scroll-snap-type: x proximity/);
  assert.match(styles, /-webkit-overflow-scrolling: touch/);
  assert.doesNotMatch(styles, /grid-template-columns: repeat\(3/);
});

test("narrow phones use no more than two horizontally scrollable rows", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 390px\)/);
  assert.match(styles, /grid-template-rows: repeat\(2, minmax\(2\.5rem, auto\)\)/);
  assert.match(styles, /grid-auto-flow: column/);
  assert.match(styles, /grid-auto-columns: max-content/);
  assert.match(styles, /max-height: 6\.7rem/);
  assert.doesNotMatch(styles, /repeat\(3, minmax\(2\.5rem, auto\)\)/);
});

test("mobile editor height adapts to the viewport and remains vertically resizable", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /height: clamp\(14rem, 48dvh, 34rem\)/);
  assert.match(styles, /min-height: clamp\(12rem, 38dvh, 16rem\)/);
  assert.match(styles, /max-height: min\(72dvh, 42rem\)/);
  assert.match(styles, /resize: vertical/);
  assert.match(styles, /@media \(max-height: 520px\) and \(orientation: landscape\)/);
});

test("mobile editor and its parent containers cannot be clipped horizontally", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /\.process-content-details,[\s\S]*max-width: 100%/);
  assert.match(styles, /\.process-content-details,[\s\S]*overflow: visible/);
  assert.match(styles, /\.tiptap-editor-frame \.ProseMirror[\s\S]*overflow-x: hidden/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /word-break: break-word/);
  assert.match(styles, /\.tiptap-media-node,[\s\S]*max-width: 100%/);
});
