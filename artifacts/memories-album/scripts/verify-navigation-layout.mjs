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

const cases = [
  { width: 1440, height: 900, side: false },
  { width: 1536, height: 900, side: false },
  { width: 1599, height: 900, side: false },
  { width: 1600, height: 900, side: true },
  { width: 1648, height: 927, side: true },
  { width: 1920, height: 1080, side: true },
  { width: 1920, height: 600, side: true, scrollable: true },
  { width: 1920, height: 575, side: false },
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
      #fixture-main { min-height: 1800px; }
      .fixture-panel {
        min-height: 50rem;
        border: 1px solid rgba(45, 67, 56, 0.2);
      }
    </style>
  </head>
  <body>
    <div class="archive-shell">
      <main id="fixture-main">
        <section class="fixture-panel" aria-label="visitor content"></section>
      </main>

      <nav class="bottom-collection-nav" aria-label="照片分類">
        <div class="bottom-nav-side bottom-nav-left">
          <button type="button" class="active">
            <span class="bottom-nav-icon" aria-hidden="true">♥</span>
            <small>婚禮流程</small>
          </button>
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">☻</span>
            <small>訪客上傳</small>
          </button>
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">◆</span>
            <small>Wedding moments</small>
          </button>
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">◆</span>
            <small>Family and friends</small>
          </button>
        </div>

        <button type="button" class="bottom-upload-action" aria-label="上傳照片">
          <span aria-hidden="true">＋</span>
          <strong>上傳</strong>
        </button>

        <div class="bottom-nav-side bottom-nav-right">
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">⌂</span>
            <small>生活照</small>
          </button>
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">◆</span>
            <small>Guest uploads</small>
          </button>
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">◆</span>
            <small>Everyday memories</small>
          </button>
          <button type="button">
            <span class="bottom-nav-icon" aria-hidden="true">◆</span>
            <small>More collections</small>
          </button>
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

  throw new Error(
    "Chrome or Chromium is required for the real-browser navigation layout test",
  );
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
        request.reject(
          new Error(`${request.method}: ${message.error.message ?? "CDP error"}`),
        );
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

async function geometry(client) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const nav = document.querySelector('.bottom-collection-nav');
      const main = document.querySelector('#fixture-main');
      const navRect = nav.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const style = getComputedStyle(nav);
      const probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      probe.style.width = 'var(--memories-side-nav-gap)';
      document.body.append(probe);
      const requiredGap = probe.getBoundingClientRect().width;
      probe.remove();
      const rect = (value) => ({
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      });
      return {
        nav: rect(navRect),
        main: rect(mainRect),
        viewport: {
          innerWidth,
          innerHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        },
        requiredGap,
        actualGap: mainRect.left - navRect.right,
        columns: style.gridTemplateColumns,
        shadow: style.boxShadow,
        scrollHeight: nav.scrollHeight,
        navClientHeight: nav.clientHeight,
      };
    })()`,
    returnByValue: true,
  });

  const value = result.result?.value;
  assert(value, "Chrome did not return layout geometry");
  return value;
}

function closeEnough(left, right, tolerance = 1) {
  return Math.abs(left - right) <= tolerance;
}

function checkCase(testCase, value) {
  const label = `${testCase.width}x${testCase.height}`;
  const details = JSON.stringify(value);
  const columnCount = value.columns.split(/\s+/).filter(Boolean).length;
  const isSide = columnCount === 1 && closeEnough(value.nav.width, 100, 1);

  assert.equal(
    value.viewport.innerWidth,
    testCase.width,
    `${label}: unexpected CSS viewport width; ${details}`,
  );
  assert.equal(
    value.viewport.innerHeight,
    testCase.height,
    `${label}: unexpected CSS viewport height; ${details}`,
  );
  assert.equal(
    isSide,
    testCase.side,
    `${label}: wrong navigation mode; ${details}`,
  );

  assert(
    value.nav.left >= -0.5 &&
      value.nav.right <= value.viewport.clientWidth + 0.5,
    `${label}: navigation leaves the horizontal layout viewport; ${details}`,
  );
  assert(
    value.nav.top >= -0.5 &&
      value.nav.bottom <= value.viewport.clientHeight + 0.5,
    `${label}: navigation leaves the vertical layout viewport; ${details}`,
  );

  if (testCase.side) {
    assert(
      value.actualGap >= value.requiredGap - 0.75,
      `${label}: navigation/content gap is ${value.actualGap}px, expected at least ${value.requiredGap}px; ${details}`,
    );
    assert(
      value.nav.right <= value.main.left + 0.5,
      `${label}: navigation overlaps visitor content; ${details}`,
    );
    assert(
      closeEnough(value.main.width, 1320, 0.75),
      `${label}: side mode changed the existing 1320px desktop content width; ${details}`,
    );
    assert.match(
      value.shadow,
      /rgba\(31, 58, 47, 0\.12\)/,
      `${label}: side-specific outward shadow is missing; ${details}`,
    );
  } else {
    const navCenter = value.nav.left + value.nav.width / 2;
    assert(
      closeEnough(navCenter, value.viewport.clientWidth / 2, 0.75),
      `${label}: bottom navigation is not centered in the layout viewport; ${details}`,
    );
    assert(
      value.nav.width <= 720.75,
      `${label}: bottom navigation exceeded its existing width; ${details}`,
    );
  }

  if (testCase.scrollable) {
    assert(
      value.scrollHeight > value.navClientHeight + 1,
      `${label}: tall side navigation did not keep its own scroll area; ${details}`,
    );
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
  const userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "memories-navigation-chrome-"),
  );
  const chromePath = findChrome();
  const chromeOutput = [];
  const chrome = spawn(
    chromePath,
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
      await client.send("Page.navigate", {
        url: `http://${host}:${fixturePort}/${marker}`,
      });
      await waitForDocument(client, marker);
      const value = await geometry(client);
      checkCase(testCase, value);
      console.log(
        `navigation layout ${testCase.width}x${testCase.height}: ${testCase.side ? "side" : "bottom"} ✓`,
      );
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
