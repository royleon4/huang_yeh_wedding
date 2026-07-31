import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientRoot = new URL("../src/client/", import.meta.url);

async function clientFile(name) {
  return readFile(new URL(name, clientRoot), "utf8");
}

test("global label wrapping stylesheet is loaded after the existing UI styles", async () => {
  const main = await clientFile("main.jsx");
  const existingStyles = main.indexOf('import "./batch-management.css";');
  const wrappingStyles = main.indexOf('import "./label-wrapping.css";');

  assert.ok(existingStyles >= 0, "existing final stylesheet import must remain");
  assert.ok(wrappingStyles > existingStyles, "wrapping overrides must load last");
});

test("text-bearing controls wrap instead of requiring one line", async () => {
  const css = await clientFile("label-wrapping.css");

  assert.match(css, /button,/);
  assert.match(css, /\[role="tab"\]/);
  assert.match(css, /summary,/);
  assert.match(css, /label,/);
  assert.match(css, /\[data-wrap-label\]/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test("known truncated public and administrator labels are explicitly untruncated", async () => {
  const css = await clientFile("label-wrapping.css");

  for (const selector of [
    ".nav-card span",
    ".process-wheel-item strong",
    ".bottom-nav-side small",
    ".general-setting-heading > span",
    ".selector-mode-preview i",
    ".admin-photo-summary-label",
    ".pinned-selected-card strong",
    ".pinned-candidate-grid span",
  ]) {
    assert.ok(css.includes(selector), `${selector} must use the global wrapping contract`);
  }

  assert.match(css, /text-overflow:\s*clip\s*!important/);
  assert.match(css, /overflow:\s*visible\s*!important/);
  assert.match(css, /white-space:\s*normal\s*!important/);
});

test("wrapped process and bottom-navigation labels can grow vertically", async () => {
  const css = await clientFile("label-wrapping.css");

  assert.match(css, /\.process-chip\s*\{[\s\S]*?max-width:[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /\.process-wheel-focus\s*\{[\s\S]*?height:\s*auto\s*!important[\s\S]*?bottom:\s*1\.55rem/);
  assert.match(css, /--memories-bottom-nav-height:\s*6\.6rem/);
  assert.match(css, /\.bottom-nav-side button\s*\{[\s\S]*?height:\s*auto/);
});
