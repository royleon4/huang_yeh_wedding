import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { publicLayoutPolishUiTransform } from "../public-layout-polish-ui-transform.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const plugin = publicLayoutPolishUiTransform();

async function transformed(relativePath) {
  const id = path.join(root, relativePath);
  const source = await readFile(id, "utf8");
  const result = plugin.transform(source, id);
  return { source, code: result?.code ?? source };
}

test("public hero removes the date divider and uses compact mobile spacing", async () => {
  const app = await transformed("src/client/App.jsx");
  const styles = await transformed("src/client/styles.css");

  assert.match(app.source, /className="botanical-rule"/);
  assert.doesNotMatch(app.code, /className="botanical-rule"/);
  assert.match(styles.code, /padding: 4\.7rem 1\.1rem 1\.35rem/);
  assert.match(styles.code, /padding: 4\.55rem 1rem 1\.2rem/);
  assert.match(styles.code, /font-size: clamp\(2\.2rem, 9vw, 3\.4rem\)/);
  assert.match(styles.code, /\.archive-subtitle:empty\s*\{\s*display: none/);
});

test("bottom album buttons keep a usable hit target with a tightly inset active chip", async () => {
  const navigation = await transformed("src/client/bottom-collection-nav.css");
  const appended = navigation.code.slice(navigation.source.length);

  assert.match(appended, /\.bottom-nav-side button/);
  assert.match(appended, /flex: 0 0 auto/);
  assert.match(appended, /min-width: 3\.55rem/);
  assert.match(appended, /min-height: 2\.75rem/);
  assert.match(appended, /padding: 0\.08rem 0\.34rem/);
  assert.match(appended, /\.bottom-nav-side button\.active\s*\{\s*background: transparent/);
  assert.match(appended, /\.bottom-nav-side button\.active::before/);
  assert.match(appended, /inset: 0\.22rem 0\.12rem/);
  assert.match(appended, /min-width: 3\.3rem/);
  assert.match(appended, /inset: 0\.24rem 0\.08rem/);
  assert.doesNotMatch(appended, /\.bottom-collection-nav\s*\{/);
  assert.doesNotMatch(appended, /--memories-bottom-nav-height/);
  assert.doesNotMatch(appended, /safe-area-inset/);
});
