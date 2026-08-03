import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readClient = (name) =>
  readFile(new URL(`../src/client/${name}`, import.meta.url), "utf8");

test("visitor archive contains no embedded administrator controls", async () => {
  const [appSource, enhancementsSource] = await Promise.all([
    readClient("App.jsx"),
    readClient("GalleryEnhancements.jsx"),
  ]);
  assert.doesNotMatch(
    `${appSource}\n${enhancementsSource}`,
    /sessionStorage|memories-admin-token|admin-delete|five title|tapsRef/,
  );
  assert.doesNotMatch(appSource, /\/admin\/api\//);
});

test("the dedicated admin route owns album, photo, and category management", async () => {
  const [mainSource, adminSource, loginSource] = await Promise.all([
    readClient("main.jsx"),
    readClient("AdminApp.jsx"),
    readClient("AdminLoginPage.jsx"),
  ]);
  assert.match(mainSource, /adminSurface\(window\.location\.pathname\)/);
  assert.match(mainSource, /<AdminLoginPage \/>/);
  assert.match(mainSource, /<AdminApp \/>/);
  assert.match(adminSource, /\/admin\/api\/albums/);
  assert.match(adminSource, /\/admin\/api\/photos/);
  assert.match(adminSource, /\/admin\/api\/categories/);
  assert.match(loginSource, /MEMORIES_ADMIN_TOKEN/);
});

test("collection controls remain sticky and span the viewport", async () => {
  const styles = await readClient("feature-controls.css");
  assert.match(
    styles,
    /\.process-section\s*{[^}]*position: sticky;[^}]*top: 0;/s,
  );
  assert.match(styles, /\.process-section\s*{[^}]*width: 100vw;/s);
  assert.match(styles, /margin-left: calc\(50% - 50vw\)/);
});

test("dynamic albums and upload use explicit React callbacks in bottom navigation", async () => {
  const [source, styles, appSource] = await Promise.all([
    readClient("BottomCollectionNav.jsx"),
    readClient("bottom-collection-nav.css"),
    readClient("App.jsx"),
  ]);
  assert.match(source, /albums\.filter\(\(_.*, index\) => index % 2 === 0\)/);
  assert.match(source, /albums\.filter\(\(_.*, index\) => index % 2 === 1\)/);
  assert.match(source, /onChoose\(album\.id\)/);
  assert.match(source, /onClick=\{onUpload\}/);
  assert.doesNotMatch(source, /querySelector|MutationObserver|\.click\(\)/);
  assert.match(styles, /\.bottom-collection-nav\s*{[^}]*position: fixed;/s);
  assert.match(
    styles,
    /\.bottom-upload-action\s*{[^}]*background: linear-gradient/s,
  );
  assert.match(appSource, /<BottomCollectionNav/);
});

test("collection and process navigation share one content positioning module", async () => {
  const [navigation, selector, collectionNavigation, enhancements] =
    await Promise.all([
      readClient("gallery-navigation.mjs"),
      readClient("ProcessSelector.jsx"),
      readClient("CollectionTabNavigation.jsx"),
      readClient("GalleryEnhancements.jsx"),
    ]);

  assert.match(navigation, /documentRef\?\.getElementById\("archive-gallery"\)/);
  assert.match(
    navigation,
    /\.process-media-sequence > \.process-media-item\[data-media-block\]/,
  );
  assert.match(navigation, /documentRef\.querySelector\("\.process-section"\)/);
  assert.match(navigation, /windowRef\.scrollTo\(\{ top, behavior \}\)/);
  assert.match(selector, /pendingSelectionRef/);
  assert.match(selector, /useEffect\(\(\) =>/);
  assert.match(selector, /requestActiveContentScroll\(\)/);
  assert.match(selector, /suspendMasonryAnchorRestoration\(\)/);
  assert.match(collectionNavigation, /closest\("\.collection-tab"\)/);
  assert.match(collectionNavigation, /requestGalleryStartScroll\(\)/);
  assert.doesNotMatch(collectionNavigation, /\.process-chip/);
  assert.match(enhancements, /<CollectionTabNavigation \/>/);
  assert.match(enhancements, /<GalleryAdminEntry \/>/);
});

test("React renders before the process API finishes", async () => {
  const source = await readClient("main.jsx");
  assert.doesNotMatch(source, /^await hydrateProcessesFromServer\(\);/m);
  assert.match(source, /void hydrateProcessesFromServer\(\)\.then/);
  assert.match(
    source,
    /createRoot\(document\.getElementById\("root"\)\)\.render/,
  );
});
