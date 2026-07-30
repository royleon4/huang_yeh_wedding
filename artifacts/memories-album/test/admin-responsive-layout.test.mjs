import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";

function runAdminTransforms(source) {
  const id = "/workspace/src/client/AdminApp.jsx";
  let code = source;
  for (const plugin of [
    adminPhotoUploaderUiTransform(),
    processContentUiTransform(),
    adminPhotoWorkspaceUiTransform(),
  ]) {
    const result = plugin.transform(code, id);
    if (result?.code) code = result.code;
  }
  return code;
}

test("application entrypoint always loads responsive administrator CSS", async () => {
  const entrypoint = await readFile(
    new URL("../src/client/main.jsx", import.meta.url),
    "utf8",
  );

  const baseStyles = entrypoint.indexOf('import "./admin.css";');
  const responsiveStyles = entrypoint.indexOf(
    'import "./admin-responsive-layout.css";',
  );
  assert.ok(baseStyles >= 0, "base administrator stylesheet must be loaded");
  assert.ok(
    responsiveStyles > baseStyles,
    "responsive administrator overrides must load after the base stylesheet",
  );
});

test("administrator photo cards use a four-up preview buffer and expand for editing", async () => {
  const source = await readFile(
    new URL("../src/client/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const code = runAdminTransforms(source);

  assert.match(code, /import "\.\/admin-responsive-layout\.css"/);
  assert.match(code, /<details className="admin-photo-card">/);
  assert.match(code, /<summary className="admin-photo-card-summary">/);
  assert.match(code, /className="admin-photo-card-editor"/);
  assert.match(code, /draft\.displayName \|\| photo\.originalFilename/);
  assert.match(code, /上傳者／作者/);
  assert.match(code, /admin-protected-photo-note/);
});

test("process cards and crowded controls use a single-column readable layout", async () => {
  const styles = await readFile(
    new URL("../src/client/admin-responsive-layout.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\.admin-category-row \{[\s\S]*display: grid !important/);
  assert.match(styles, /\.admin-category-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(styles, /\.admin-card-actions \{[\s\S]*flex-direction: column/);
  assert.match(styles, /\.admin-category-row \.admin-youtube-autoplay[\s\S]*grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.process-content-inline-editor \.process-content-save \{[\s\S]*width: 100%/);
});

test("administrator photo and pinned-photo pickers show four previews per row", async () => {
  const styles = await readFile(
    new URL("../src/client/admin-responsive-layout.css", import.meta.url),
    "utf8",
  );
  const picker = await readFile(
    new URL("../src/client/PinnedPhotoPicker.jsx", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\.admin-photo-list \{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.admin-photo-card\[open\] \{[\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /\.pinned-candidate-grid \{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(picker, /onClick=\{\(\) => toggle\(photo\.id\)\}/);
  assert.match(picker, /active \? `置頂 \$\{index \+ 1\}` : photoLabel\(photo\)/);
});
