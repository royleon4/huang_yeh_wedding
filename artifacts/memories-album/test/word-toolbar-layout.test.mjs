import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wordStylesUrl = new URL("../src/client/word-document.css", import.meta.url);
const mobileStylesUrl = new URL("../src/client/rich-text-mobile.css", import.meta.url);

test("desktop editor toolbar wraps all controls inside the editor column", async () => {
  const styles = await readFile(wordStylesUrl, "utf8");

  assert.match(styles, /@media \(min-width: 721px\)/);
  assert.match(styles, /\.tiptap-toolbar\s*\{[\s\S]*flex-wrap: wrap/);
  assert.match(styles, /\.tiptap-toolbar\s*\{[\s\S]*overflow-x: visible/);
  assert.match(styles, /\.tiptap-toolbar-spacer\s*\{[\s\S]*flex: 1 1 0\.5rem/);
});

test("desktop attachment actions wrap instead of crossing the editor right edge", async () => {
  const styles = await readFile(wordStylesUrl, "utf8");

  assert.match(
    styles,
    /\.process-attachment-library-grid article\s*\{[\s\S]*flex-wrap: wrap/,
  );
  assert.match(
    styles,
    /\.process-attachment-library-actions\s*\{[\s\S]*flex-wrap: wrap/,
  );
  assert.match(
    styles,
    /\.process-attachment-library-actions\s*\{[\s\S]*max-width: 100%/,
  );
  assert.match(
    styles,
    /\.process-attachment-library-actions\s*\{[\s\S]*margin-inline-start: auto/,
  );
});

test("mobile editor toolbar keeps its existing horizontal scrolling behavior", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /\.tiptap-toolbar\s*\{[\s\S]*flex-wrap: nowrap/);
  assert.match(styles, /\.tiptap-toolbar\s*\{[\s\S]*overflow-x: auto/);
});
