import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mobileStylesUrl = new URL("../src/client/rich-text-mobile.css", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);

test("mobile rich text toolbar styles are included in the application", async () => {
  const index = await readFile(indexUrl, "utf8");
  assert.match(index, /rich-text-mobile\.css/);
});

test("mobile rich text toolbar uses a wrapped grid instead of a clipped row", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /\.tiptap-toolbar[\s\S]*display: grid/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /overflow: visible/);
  assert.match(styles, /\.tiptap-toolbar-divider,[\s\S]*display: none/);
  assert.match(styles, /\.tiptap-toolbar-button::after[\s\S]*content: attr\(aria-label\)/);
  assert.match(styles, /\.tiptap-toolbar-button\.is-wide[\s\S]*grid-column: 1 \/ -1/);
});

test("very narrow phones fall back to two toolbar columns", async () => {
  const styles = await readFile(mobileStylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});
