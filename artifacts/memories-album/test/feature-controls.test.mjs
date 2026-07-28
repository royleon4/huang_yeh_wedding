import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSourceUrl = new URL(
  "../src/client/ProcessSyncAdmin.jsx",
  import.meta.url,
);
const stylesUrl = new URL("../src/client/feature-controls.css", import.meta.url);
const appSourceUrl = new URL("../src/client/App.jsx", import.meta.url);

test("feature navigation is hidden by default and only changed through admin API", async () => {
  const [adminSource, styles] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(
    adminSource,
    /document\.documentElement\.dataset\.memoriesPrimaryNav = "hidden"/,
  );
  assert.match(styles, /data-memories-primary-nav="hidden"[^}]+\.primary-nav/s);
  assert.match(adminSource, /\/Memories\/api\/admin\/settings/);
});

test("admin has no visible URL or button entrance and opens after five title taps", async () => {
  const [adminSource, appSource, styles] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.doesNotMatch(adminSource, /searchParams.*admin|\?admin=1/);
  assert.match(adminSource, /tapsRef\.current\.length < 5/);
  assert.match(adminSource, /\/Memories\/api\/admin\/session/);
  assert.match(styles, /\.header-tools \.quiet-button:first-child\s*{\s*display: none;/);
  assert.match(appSource, /className="archive-header"/);
});

test("upload is a floating control and collection controls remain sticky", async () => {
  const [adminSource, styles] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(adminSource, /className="floating-upload-button"/);
  assert.match(styles, /\.floating-upload-button\s*{[^}]*position: fixed;/s);
  assert.match(styles, /\.process-section\s*{[^}]*position: sticky;[^}]*top: 0;/s);
});
