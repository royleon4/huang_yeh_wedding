import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../src/client/gallery-tweaks.css", import.meta.url);

test("desktop main content stays inside the sidebar content column", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(
    styles,
    /@media \(min-width: 44rem\)[\s\S]*\.archive-shell > main\s*\{[\s\S]*width: auto;[\s\S]*margin-inline: 0\.75rem;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 44rem\)[\s\S]*\.archive-shell > main \.process-section\s*\{[\s\S]*width: 100%;[\s\S]*margin-left: 0;[\s\S]*margin-right: 0;/,
  );
});
