import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const host = "127.0.0.1";
const sidebarShare = 1 / 15;
const contentShare = 14 / 15;
const sidebarThreshold = 42.875 * 16;

const cases = [
  { width: 640, height: 900, side: false },
  { width: 700, height: 900, side: false },
  { width: 720, height: 900, side: true, threeColumns: true },
  { width: 1024, height: 900, side: true, sticky: true },
  { width: 1440, height: 900, side: true },
  { width: 720, height: 500, side: true, scrollable: true },
];

const fixture = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Memories navigation layout fixture</title>
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/bottom-collection-nav.css" />
    <style>
      body { min-height: 200vh; }
      .archive-header { min-height: 12rem; }
      .primary-nav { min-height: 5rem; }
      #fixture-main { min-height: 1200px; }
      .archive-footer { min-height: 8rem; }
      .photo-card { min-height: 12rem; }
    </style>
  </head>
  <body>
    <div class="archive-shell">
      <div class="paper-grain" aria-hidden="true"></div>
      <header class="archive-header"></header>
      <nav class="primary-nav" aria-label="archive navigation"></nav>
      <main id="fixture-main">
        <section class="gallery-section">
          <div class="masonry-grid">
            <article class="photo-card"></article>
            <article class="photo-card"></article>
            <article class="photo-card"></article>
            <article class="photo-card"></article>
          </div>
        </section>
      </main>
      <footer class="archive-footer"></footer>

      <nav class="bottom-collection-nav" aria-label="照片分類">
        <div class="bottom-nav-side bottom-nav-left">
          <button type="button" class="active"><span class="bottom-nav-icon">♥</span><small>婚禮流程</small></button>
          <button type="button"><span class="bottom-nav-icon">☻</span><small>訪客上傳</small></button>
          <button type="button"><span class="bottom-nav-icon">◆</span><small>Wedding moments</small></button>
          <button type="button"><span class="bottom-nav-icon">◆</span><small>Family and friends</small></button>
        </div>
        <button type="button" class="bottom-upload-action"><span>＋</span><strong>上傳</strong></button>
        <div class="bottom-nav-side bottom-nav-right">
          <button type="button"><span class="bottom-nav-icon">⌂</span><small>生活照</small></button>
          <button type="button"><span class="bottom-nav-icon">◆</span><small>Guest uploads</small></button>
          <button type="button"><span class="bottom-nav-icon">◆</span><small>Everyday memories</small></button>
          <button type="button"><span class="bottom-nav-icon">◆</span><small>More collections</small></button>
        </div>
      </nav>
    </div>
  </body>
</html>`;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) return candidate;
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }

  throw new Error("Chrome or Chromium is required for the browser layout test");
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return address.port;
}

async function freePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForDebugger(port, chromeLog) {
  const endpoint = `http://${host}:${port}/json/version`;
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
      lastError = new Error(`Chrome debugger returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(125);
  }
  throw new Error(
    `Chrome debugger did not start: ${lastError?.message ?? "unknown error"}\n${chromeLog()}`,
  );
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(`${request.method}: ${message.error.message}`));
      } else {
        request.resolve(message.result ?? {});
      }
    });

    socket.addEventListener("close", () => {
      for (const request of this.pending.values()) {
        request.reject(new Error(`Chrome closed during ${request.method}`));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("Could not connect to Chrome DevTools Protocol")),
        { once: true },
      );
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForDocument(client, marker) {
  const expression = `document.readyState === 'complete' && location.search === ${JSON.stringify(marker)}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await sleep(50);
  }
  throw new Error(`Browser fixture did not finish loading ${marker}`);
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  return result.result?.value;
}

async function geometry(client) {
  return evaluate(
    client,
    `(() => {
      const rect = (selector) => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
      };
      const nav = document.querySelector('.bottom-collection-nav');
      const upload = document.querySelector('.bottom-upload-action');
      const shell = document.querySelector('.archive-shell');
      const gallery = document.querySelector('.masonry-grid');
      const navStyle = getComputedStyle(nav);
      const shellStyle = getComputedStyle(shell);
      const galleryStyle = getComputedStyle(gallery);
      return {
        nav: rect('.bottom-collection-nav'),
        upload: rect('.bottom-upload-action'),
        shell: rect('.archive-shell'),
        header: rect('.archive-header'),
        main: rect('#fixture-main'),
        viewport: {
          innerWidth,
          innerHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        },
        navPosition: navStyle.position,
        navOverflowY: navStyle.overflowY,
        navShadow: navStyle.boxShadow,
        navRadius: navStyle.borderRadius,
        shellDisplay: shellStyle.display,
        shellColumns: shellStyle.gridTemplateColumns,
        galleryColumns: galleryStyle.gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
        navScrollHeight: nav.scrollHeight,
        navClientHeight: nav.clientHeight,
      };
    })()`,
  );
}

function closeEnough(left, right, tolerance = 1) {
  return Math.abs(left - right) <= tolerance;
}

function checkCase(testCase, value) {
  const label = `${testCase.width}x${testCase.height}`;
  const details = JSON.stringify(value);

  assert.equal(value.viewport.innerWidth, testCase.width, `${label}: wrong viewport width`);
  assert.equal(value.viewport.innerHeight, testCase.height, `${label}: wrong viewport height`);

  if (testCase.side) {
    assert(
      value.viewport.clientWidth >= sidebarThreshold,
      `${label}: page container is below the sidebar threshold; ${details}`,
    );
    assert.equal(value.shellDisplay, "grid", `${label}: shell is not a two-column grid; ${details}`);
    assert.equal(value.navPosition, "sticky", `${label}: sidebar is not sticky; ${details}`);
    assert.notEqual(value.navPosition, "fixed", `${label}: sidebar still floats; ${details}`);
    assert(closeEnough(value.nav.left, value.shell.left, 0.75), `${label}: sidebar is not in the left grid column; ${details}`);
    assert(closeEnough(value.nav.right, value.header.left, 0.75), `${label}: right content does not start after the sidebar; ${details}`);
    assert(closeEnough(value.nav.width, value.shell.width * sidebarShare, 0.9), `${label}: sidebar is not one third of its former 20% width; ${details}`);
    assert(closeEnough(value.header.width, value.shell.width * contentShare, 0.9), `${label}: right content is not the remaining 14/15; ${details}`);
    assert(value.main.left >= value.nav.right - 0.5, `${label}: sidebar overlaps main content; ${details}`);
    assert(value.nav.right <= value.header.left + 0.5, `${label}: sidebar overlaps header content; ${details}`);
    assert(value.upload.right <= value.nav.right + 0.5, `${label}: upload button overflows the narrower sidebar; ${details}`);
    assert(value.upload.left >= value.nav.left - 0.5, `${label}: upload button leaves the narrower sidebar; ${details}`);
    assert.equal(value.navShadow, "none", `${label}: sidebar still has a floating shadow; ${details}`);
    assert.equal(value.navRadius, "0px", `${label}: sidebar still looks like a floating card; ${details}`);
    assert(value.nav.bottom <= value.viewport.clientHeight + 0.75, `${label}: sidebar leaves the viewport; ${details}`);
  } else {
    assert(
      value.viewport.clientWidth < sidebarThreshold,
      `${label}: page container unexpectedly meets the sidebar threshold; ${details}`,
    );
    assert.equal(value.navPosition, "fixed", `${label}: bottom navigation no longer stays fixed; ${details}`);
    const center = value.nav.left + value.nav.width / 2;
    assert(closeEnough(center, value.viewport.clientWidth / 2, 0.75), `${label}: bottom navigation is not centered; ${details}`);
    assert.equal(value.shellDisplay, "block", `${label}: narrow layout unexpectedly became a grid; ${details}`);
  }

  if (testCase.threeColumns) {
    assert.equal(value.galleryColumns, 3, `${label}: right pane cannot retain a three-photo row; ${details}`);
  }

  if (testCase.scrollable) {
    assert.equal(value.navOverflowY, "auto", `${label}: sidebar cannot scroll; ${details}`);
    assert(value.navScrollHeight > value.navClientHeight + 1, `${label}: tall sidebar has no internal scroll range; ${details}`);
  }
}

async function stopChrome(chrome) {
  let exited = chrome.exitCode !== null;
  chrome.once("exit", () => {
    exited = true;
  });
  if (!exited) chrome.kill("SIGTERM");
  await sleep(750);
  if (!exited) chrome.kill("SIGKILL");
}

async function main() {
  const [styles, navigation] = await Promise.all([
    readFile(path.join(root, "src/client/styles.css"), "utf8"),
    readFile(path.join(root, "src/client/bottom-collection-nav.css"), "utf8"),
  ]);

  const server = http.createServer((request, response) => {
    if (request.url === "/styles.css") {
      response.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      response.end(styles);
      return;
    }
    if (request.url === "/bottom-collection-nav.css") {
      response.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      response.end(navigation);
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });

  const fixturePort = await listen(server);
  const debuggerPort = await freePort();
  const userDataDirectory = await mkdtemp(path.join(os.tmpdir(), "memories-navigation-chrome-"));
  const chromeOutput = [];
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debuggerPort}`,
      `--remote-debugging-address=${host}`,
      `--user-data-dir=${userDataDirectory}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  chrome.stderr.setEncoding("utf8");
  chrome.stderr.on("data", (chunk) => {
    chromeOutput.push(chunk);
    if (chromeOutput.length > 30) chromeOutput.shift();
  });

  let client;
  try {
    await waitForDebugger(debuggerPort, () => chromeOutput.join(""));
    const targetResponse = await fetch(
      `http://${host}:${debuggerPort}/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" },
    );
    assert.equal(targetResponse.ok, true, "Chrome could not create a test page");
    const target = await targetResponse.json();
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    for (const testCase of cases) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: testCase.width,
        height: testCase.height,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: testCase.width,
        screenHeight: testCase.height,
      });
      const marker = `?viewport=${testCase.width}x${testCase.height}`;
      await client.send("Page.navigate", { url: `http://${host}:${fixturePort}/${marker}` });
      await waitForDocument(client, marker);
      const value = await geometry(client);
      checkCase(testCase, value);

      if (testCase.sticky) {
        await evaluate(client, "scrollTo(0, 360)");
        await sleep(50);
        const afterScroll = await geometry(client);
        assert(closeEnough(afterScroll.nav.top, 0, 0.75), `${testCase.width}x${testCase.height}: sticky sidebar moved while scrolling`);
      }

      console.log(`navigation layout ${testCase.width}x${testCase.height}: ${testCase.side ? "sidebar" : "bottom"} ✓`);
    }
  } finally {
    client?.close();
    await stopChrome(chrome);
    await new Promise((resolve) => server.close(resolve));
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
