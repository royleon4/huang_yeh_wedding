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
  { width: 240, height: 700 },
  { width: 320, height: 700 },
  { width: 375, height: 800 },
  { width: 720, height: 800 },
  { width: 1024, height: 900 },
];

function fixture(styles, marker) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Document preview width fixture</title>
  <style>${styles}</style>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; max-width: 100%; margin: 0; overflow-x: clip; }
    body { padding: 12px; }
    .article-column { width: min(42rem, 100%); max-width: 100%; min-width: 0; margin: 0 auto; }
    .mock-renderer-list { width: 1280px; min-width: 1280px; }
    .mock-renderer-slide { width: 1280px; height: 720px; background: white; }
    .process-page-document-preview { max-height: 15rem; }
  </style>
</head>
<body data-marker=${JSON.stringify(marker)}>
  <main class="article-column">
    <section class="process-page-document" data-render-state="ready">
      <div class="process-page-document-toolbar">
        <div>
          <strong>這是一個非常長而且不能造成瀏覽器水平溢位的 PDF 與 PowerPoint 文件名稱</strong>
          <small>PowerPoint 簡報</small>
        </div>
        <div>
          <a href="#">開啟原檔</a>
          <button type="button" class="danger">從文章移除</button>
        </div>
      </div>
      <div class="process-page-document-preview" data-document-kind="pdf">
        <section class="process-page-document-page" style="--process-page-document-page-width: 1600px">
          <canvas class="process-page-document-pdf-canvas" width="1600" height="2200"></canvas>
        </section>
      </div>
    </section>
    <section class="process-page-document" data-render-state="ready">
      <div class="process-page-document-preview" data-document-kind="pptx">
        <div class="process-page-document-pptx-stage">
          <div class="mock-renderer-list"><div class="mock-renderer-slide"></div></div>
        </div>
      </div>
    </section>
    <section class="process-page-document" data-render-state="ready">
      <div class="process-page-document-preview" data-document-kind="ppt">
        <iframe class="process-page-document-office-frame" title="legacy preview"></iframe>
      </div>
    </section>
  </main>
</body>
</html>`;
}

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
  throw new Error("Chrome or Chromium is required for the document layout test");
}

async function freePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
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
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result ?? {});
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  return result.result?.value;
}

async function waitForDocument(client, marker) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      client,
      `document.readyState === 'complete' && document.body?.dataset.marker === ${JSON.stringify(marker)}`,
    );
    if (ready) return;
    await sleep(50);
  }
  throw new Error(`Document layout fixture did not load ${marker}`);
}

async function geometry(client) {
  return evaluate(
    client,
    `(() => {
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return { left: value.left, right: value.right, width: value.width };
      };
      const previews = [...document.querySelectorAll('.process-page-document-preview')];
      return {
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.documentElement.scrollWidth,
        article: rect(document.querySelector('.article-column')),
        documents: [...document.querySelectorAll('.process-page-document')].map(rect),
        previews: previews.map((preview) => ({
          rect: rect(preview),
          overflowX: getComputedStyle(preview).overflowX,
        })),
        canvas: rect(document.querySelector('.process-page-document-pdf-canvas')),
        page: rect(document.querySelector('.process-page-document-page')),
        pptxStage: rect(document.querySelector('.process-page-document-pptx-stage')),
        pptxList: rect(document.querySelector('.mock-renderer-list')),
        officeFrame: rect(document.querySelector('.process-page-document-office-frame')),
        controls: [...document.querySelectorAll('.process-page-document-toolbar a, .process-page-document-toolbar button')].map(rect),
      };
    })()`,
  );
}

function inside(inner, outer, tolerance = 0.75) {
  return inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance;
}

function check(testCase, value) {
  const label = `${testCase.width}x${testCase.height}`;
  const details = JSON.stringify(value);
  assert.equal(value.innerWidth, testCase.width, `${label}: wrong emulated width; ${details}`);
  assert(value.clientWidth <= value.innerWidth, `${label}: invalid client width; ${details}`);
  assert(
    value.bodyScrollWidth <= value.clientWidth,
    `${label}: document preview creates page-level horizontal overflow; ${details}`,
  );
  for (const documentRect of value.documents) {
    assert(inside(documentRect, value.article), `${label}: document leaves article width; ${details}`);
  }
  for (const preview of value.previews) {
    assert(inside(preview.rect, value.article), `${label}: preview leaves article width; ${details}`);
    assert.equal(preview.overflowX, "hidden", `${label}: preview permits horizontal overflow; ${details}`);
  }
  assert(inside(value.page, value.previews[0].rect), `${label}: PDF page leaves preview; ${details}`);
  assert(inside(value.canvas, value.page), `${label}: PDF canvas leaves page; ${details}`);
  assert(inside(value.pptxStage, value.previews[1].rect), `${label}: PPTX stage leaves preview; ${details}`);
  assert(inside(value.pptxList, value.pptxStage), `${label}: PPTX renderer list is not fitted; ${details}`);
  assert(inside(value.officeFrame, value.previews[2].rect), `${label}: PPT iframe leaves preview; ${details}`);
  for (const control of value.controls) {
    assert(inside(control, value.documents[0]), `${label}: document control is clipped; ${details}`);
  }
}

async function stopChrome(chrome) {
  if (chrome.exitCode === null) chrome.kill("SIGTERM");
  await sleep(500);
  if (chrome.exitCode === null) chrome.kill("SIGKILL");
}

async function main() {
  const styles = await readFile(path.join(root, "src/client/page-document.css"), "utf8");
  const debuggerPort = await freePort();
  const userDataDirectory = await mkdtemp(path.join(os.tmpdir(), "memories-document-chrome-"));
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
  chrome.stderr.on("data", (chunk) => chromeOutput.push(chunk));

  let client;
  try {
    await waitForDebugger(debuggerPort, () => chromeOutput.slice(-20).join(""));
    const targetResponse = await fetch(
      `http://${host}:${debuggerPort}/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" },
    );
    assert.equal(targetResponse.ok, true);
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
      const marker = `document-${testCase.width}x${testCase.height}`;
      const documentUrl = `data:text/html;charset=utf-8,${encodeURIComponent(fixture(styles, marker))}`;
      await client.send("Page.navigate", { url: documentUrl });
      await waitForDocument(client, marker);
      const value = await geometry(client);
      check(testCase, value);
      console.log(`document preview ${testCase.width}x${testCase.height}: contained ✓`);
    }
  } finally {
    client?.close();
    await stopChrome(chrome);
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
