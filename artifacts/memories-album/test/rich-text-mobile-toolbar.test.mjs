import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mobileStylesUrl = new URL("../src/client/rich-text-mobile.css", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);

test("mobile rich text toolbar styles are included in the application", async () => {
  const index = await readFile(indexUrl, "utf8");
  assert.match(index, /rich-text-mobile\.css/);
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

  assert.match(styles, /height: clamp\(16rem, 50dvh, 34rem\)/);
  assert.match(styles, /max-height: 72dvh/);
  assert.match(styles, /resize: vertical/);
});
