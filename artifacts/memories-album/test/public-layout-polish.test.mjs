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

test("bottom album buttons keep their original footprint and compact only the inner chip", async () => {
  const navigation = await transformed("src/client/bottom-collection-nav.css");
  const component = await readFile(
    path.join(root, "src/client/BottomCollectionNav.jsx"),
    "utf8",
  );
  const appended = navigation.code.slice(navigation.source.length);

  assert.match(component, /className="bottom-nav-chip"/);
  assert.match(appended, /\.bottom-nav-side button/);
  assert.match(appended, /flex: 0 0 min\(5\.2rem, 46%\)/);
  assert.match(appended, /min-height: 3\.7rem/);
  assert.match(appended, /padding: 0/);
  assert.match(appended, /\.bottom-nav-chip/);
  assert.match(appended, /min-width: 3\.7rem/);
  assert.match(appended, /min-height: 2\.55rem/);
  assert.match(appended, /padding: 0\.22rem 0\.42rem/);
  assert.match(
    appended,
    /\.bottom-nav-side button\.active \.bottom-nav-chip\s*\{\s*background:/,
  );
  assert.doesNotMatch(appended, /button\.active::before/);
  assert.doesNotMatch(appended, /\.bottom-collection-nav\s*\{/);
  assert.doesNotMatch(appended, /--memories-bottom-nav-height/);
  assert.doesNotMatch(appended, /safe-area-inset/);
});
