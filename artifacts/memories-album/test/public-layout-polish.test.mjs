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

test("bottom navigation is shorter while album buttons flex to nearly its full height", async () => {
  const navigation = await readFile(
    path.join(root, "src/client/bottom-collection-nav.css"),
    "utf8",
  );

  assert.match(
    navigation,
    /--memories-bottom-nav-height: clamp\(4\.35rem, 11\.5vw, 4\.75rem\)/,
  );
  assert.match(
    navigation,
    /grid-template-columns:[\s\S]*clamp\(4\.45rem, 12vw, 5\.25rem\)/,
  );
  assert.match(navigation, /\.bottom-nav-side\s*\{[\s\S]*align-items: stretch/);
  assert.match(
    navigation,
    /flex: 1 1 clamp\(4rem, 18vw, 5\.3rem\)/,
  );
  assert.match(
    navigation,
    /min-height: calc\([\s\S]*var\(--memories-bottom-nav-height\)[\s\S]*var\(--memories-bottom-nav-block-padding\) \* 2/,
  );
  assert.match(navigation, /padding:[\s\S]*clamp\(0\.18rem, 0\.6vw, 0\.32rem\)/);
  assert.match(navigation, /font-size: clamp\(1rem, 3vw, 1\.2rem\)/);
  assert.match(navigation, /white-space: normal/);
  assert.match(
    navigation,
    /@media \(max-width: 430px\)[\s\S]*--memories-bottom-nav-height: clamp\(4\.2rem, 18vw, 4\.55rem\)/,
  );
  assert.doesNotMatch(navigation, /bottom-nav-chip/);
});
