import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  registerMemoriesServiceWorker,
} from "../src/client/pwa-registration.mjs";

const artifact = (name) => new URL(`../${name}`, import.meta.url);

test("manifest is scoped to the archive and supports standalone launch", async () => {
  const manifest = JSON.parse(await readFile(artifact("manifest.webmanifest"), "utf8"));

  assert.equal(manifest.id, "/Memories/");
  assert.equal(manifest.scope, "/Memories/");
  assert.equal(manifest.start_url, "/Memories/?source=pwa");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#f3eee2");
  assert.ok(manifest.icons.some((icon) => icon.src === "/Memories/api/settings/site-icon"));
});

test("service worker caches only public shell and static assets", async () => {
  const worker = await readFile(artifact("sw.js"), "utf8");

  assert.match(worker, /\/Memories\/offline\.html/);
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /networkFirstNavigation/);
  assert.match(worker, /cacheFirstStatic/);
  assert.match(worker, /\/Memories\/admin/);
  assert.match(worker, /\/Memories\/manage\//);
  assert.match(worker, /\/Memories\/api\//);
  assert.doesNotMatch(worker, /cache\.put\([^\n]*api\//);
});

test("registration is public-only, secure, scoped, and bypasses worker script cache", async () => {
  const registrations = [];
  const navigatorLike = {
    serviceWorker: {
      async register(url, options) {
        registrations.push({ url, options });
        return { scope: options.scope };
      },
    },
  };

  const registered = await registerMemoriesServiceWorker({
    navigatorLike,
    locationLike: {
      protocol: "https:",
      hostname: "leon-loves-yeh.com",
      pathname: "/Memories/",
    },
  });
  assert.deepEqual(registrations, [
    {
      url: "/Memories/sw.js",
      options: { scope: "/Memories/", updateViaCache: "none" },
    },
  ]);
  assert.equal(registered.scope, "/Memories/");

  assert.equal(
    await registerMemoriesServiceWorker({
      navigatorLike,
      locationLike: {
        protocol: "https:",
        hostname: "leon-loves-yeh.com",
        pathname: "/Memories/admin",
      },
    }),
    null,
  );
  assert.equal(
    await registerMemoriesServiceWorker({
      navigatorLike,
      locationLike: {
        protocol: "http:",
        hostname: "example.com",
        pathname: "/Memories/",
      },
    }),
    null,
  );
  assert.equal(registrations.length, 1);
});

test("entry document and production build include all PWA assets", async () => {
  const [index, build, main, offline] = await Promise.all([
    readFile(artifact("index.html"), "utf8"),
    readFile(artifact("scripts/build.mjs"), "utf8"),
    readFile(artifact("src/client/main.jsx"), "utf8"),
    readFile(artifact("offline.html"), "utf8"),
  ]);

  assert.match(index, /rel="manifest" href="\/Memories\/manifest\.webmanifest"/);
  assert.match(index, /apple-mobile-web-app-capable/);
  assert.match(main, /scheduleMemoriesServiceWorkerRegistration\(\)/);
  for (const file of ["manifest.webmanifest", "offline.html", "sw.js"]) {
    assert.match(build, new RegExp(file.replace(".", "\\.")));
  }
  assert.match(offline, /目前沒有網路/);
  assert.match(offline, /You are offline/);
});
