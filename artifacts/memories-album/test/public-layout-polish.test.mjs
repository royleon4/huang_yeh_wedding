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

test("language switcher stays at the hero top right and scrolls away with it", async () => {
  const controls = await readFile(
    path.join(root, "src/client/feature-controls.css"),
    "utf8",
  );
  const styles = await readFile(
    path.join(root, "src/client/styles.css"),
    "utf8",
  );

  assert.match(styles, /\.archive-header\s*\{[\s\S]*position: relative;/);
  assert.match(
    controls,
    /\.header-tools\s*\{[\s\S]*position: absolute;[\s\S]*top: max\(var\(--language-toggle-edge\), env\(safe-area-inset-top\)\);/,
  );
  assert.match(
    controls,
    /\.header-tools\s*\{[\s\S]*right: max\(var\(--language-toggle-edge\), env\(safe-area-inset-right\)\);[\s\S]*left: auto;/,
  );
  assert.match(controls, /--language-toggle-edge: clamp\(/);
  assert.match(controls, /\.header-tools\s*\{[\s\S]*z-index: 2;/);
  assert.doesNotMatch(
    controls,
    /\.header-tools\s*\{[\s\S]*position: fixed;/,
  );
  assert.match(
    controls,
    /\.header-tools \.quiet-button\s*\{[\s\S]*min-height: 2\.75rem;[\s\S]*pointer-events: auto;/,
  );
});

test("bottom navigation stays compact while icons and labels grow responsively", async () => {
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
  assert.match(navigation, /flex: 1 1 clamp\(4rem, 18vw, 5\.3rem\)/);
  assert.match(
    navigation,
    /min-height: calc\([\s\S]*var\(--memories-bottom-nav-height\)[\s\S]*var\(--memories-bottom-nav-block-padding\) \* 2/,
  );
  assert.match(
    navigation,
    /padding:[\s\S]*clamp\(0\.16rem, 0\.55vw, 0\.28rem\)/,
  );
  assert.match(navigation, /font-size: clamp\(1\.35rem, 4\.6vw, 1\.78rem\)/);
  assert.match(navigation, /font-size: clamp\(0\.72rem, 2\.15vw, 0\.88rem\)/);
  assert.match(navigation, /--memories-bottom-nav-background/);
  assert.match(navigation, /--memories-bottom-nav-active-background/);
  assert.match(navigation, /white-space: normal/);
  assert.match(
    navigation,
    /@media \(max-width: 430px\)[\s\S]*--memories-bottom-nav-height: clamp\(4\.2rem, 18vw, 4\.55rem\)/,
  );
  assert.doesNotMatch(navigation, /bottom-nav-chip/);
});
