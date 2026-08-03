import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const host = "127.0.0.1";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
  throw new Error("Chrome or Chromium is required for the guestbook browser test");
}

async function waitForUrl(url, label) {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`${label} did not start: ${lastError?.message ?? "unknown error"}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      } else {
        pending.resolve(message.result ?? {});
      }
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error(`Chrome closed during ${pending.method}`));
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

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  }
  return result.result?.value;
}

async function waitForGuestbook(client) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const ready = await evaluate(
      client,
      `(() => {
        const cards = [...document.querySelectorAll('.message-card')];
        return cards.length === 2 && cards.every((card) => Number(card.dataset.masonrySpan) > 1);
      })()`,
    );
    if (ready) return;
    await sleep(100);
  }
  throw new Error("Guestbook cards never received measured masonry spans");
}

function sendJson(response, value, delay = 0) {
  const send = () => {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(value));
  };
  if (delay > 0) setTimeout(send, delay);
  else send();
}

function publicApiResponse(url, response) {
  if (url.pathname === "/Memories/api/albums") {
    sendJson(response, {
      albums: [
        {
          id: "messages",
          titleZh: "留言區",
          titleEn: "Guestbook",
          descriptionZh: "收藏每位訪客留下的祝福與留言。",
          descriptionEn: "A collection of blessings and messages from our guests.",
          albumType: "message",
          displayOrder: 1,
          isVisible: true,
          isSystem: true,
        },
      ],
    });
    return true;
  }
  if (url.pathname === "/Memories/api/settings") {
    sendJson(response, {});
    return true;
  }
  if (url.pathname === "/Memories/api/processes") {
    sendJson(response, {
      processes: [],
      allProcess: {
        id: "all",
        labelZh: "全部流程",
        labelEn: "All moments",
        youtubeVideoId: null,
        youtubeAutoplay: false,
        showAllPhotos: true,
        contentHtmlZh: "",
        contentHtmlEn: "",
        dividerPaddingTop: 12,
        dividerPaddingBottom: 12,
      },
    });
    return true;
  }
  if (url.pathname === "/Memories/api/settings/messages") {
    sendJson(
      response,
      {
        albumId: "messages",
        messages: [
          {
            id: "message-a",
            albumId: "messages",
            visitorName: "小安",
            body: "祝福你們永遠幸福，日日都有新的恩典。",
            messageAt: "2026-06-20T03:00:00.000Z",
          },
          {
            id: "message-b",
            albumId: "messages",
            visitorName: "An",
            body: "God bless your marriage and every new chapter together.",
            messageAt: "2026-06-21T03:00:00.000Z",
          },
        ],
      },
      400,
    );
    return true;
  }
  if (url.pathname === "/Memories/api/photos") {
    sendJson(response, { photos: [], nextCursor: null });
    return true;
  }
  if (url.pathname.startsWith("/Memories/api/")) {
    sendJson(response, {});
    return true;
  }
  return false;
}

async function stopProcess(process) {
  if (!process || process.exitCode !== null) return;
  process.kill("SIGTERM");
  await sleep(750);
  if (process.exitCode === null) process.kill("SIGKILL");
}

async function main() {
  const vitePort = await freePort();
  const viteOutput = [];
  const vite = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--config",
      "vite.routes.config.js",
      "--host",
      host,
      "--port",
      String(vitePort),
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "ignore", "pipe"] },
  );
  vite.stderr.setEncoding("utf8");
  vite.stderr.on("data", (chunk) => {
    viteOutput.push(chunk);
    if (viteOutput.length > 30) viteOutput.shift();
  });

  let proxy;
  let chrome;
  let client;
  let userDataDirectory;
  try {
    await waitForUrl(`http://${host}:${vitePort}/Memories/`, "Vite server");

    proxy = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", `http://${host}`);
      if (publicApiResponse(url, response)) return;

      const upstream = http.request(
        {
          hostname: host,
          port: vitePort,
          method: request.method,
          path: request.url,
          headers: { ...request.headers, host: `${host}:${vitePort}` },
        },
        (upstreamResponse) => {
          response.writeHead(
            upstreamResponse.statusCode ?? 502,
            upstreamResponse.headers,
          );
          upstreamResponse.pipe(response);
        },
      );
      upstream.on("error", (error) => {
        response.writeHead(502, { "content-type": "text/plain" });
        response.end(error.message);
      });
      request.pipe(upstream);
    });
    const proxyPort = await listen(proxy);

    const debuggerPort = await freePort();
    userDataDirectory = await mkdtemp(
      path.join(os.tmpdir(), "memories-guestbook-chrome-"),
    );
    const chromeOutput = [];
    chrome = spawn(
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

    await waitForUrl(
      `http://${host}:${debuggerPort}/json/version`,
      "Chrome debugger",
    );
    const pageUrl = `http://${host}:${proxyPort}/Memories/?guestbook-browser-test=1`;
    const targetResponse = await fetch(
      `http://${host}:${debuggerPort}/json/new?${encodeURIComponent(pageUrl)}`,
      { method: "PUT" },
    );
    assert.equal(targetResponse.ok, true, "Chrome could not create a guestbook page");
    const target = await targetResponse.json();
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await client.send("Page.reload", { ignoreCache: true });
    await waitForGuestbook(client);

    const result = await evaluate(
      client,
      `(() => {
        const rect = (element) => {
          const value = element.getBoundingClientRect();
          return { top: value.top, bottom: value.bottom, width: value.width, height: value.height };
        };
        const grid = document.querySelector('.message-grid');
        const cards = [...document.querySelectorAll('.message-card')];
        return {
          count: document.querySelector('.message-album-heading')?.textContent?.trim(),
          grid: rect(grid),
          action: rect(document.querySelector('.message-action-card')),
          cards: cards.map((card) => ({
            span: Number(card.dataset.masonrySpan),
            card: rect(card),
            body: rect(card.querySelector('.message-card-body')),
            paragraph: rect(card.querySelector('.message-card-body p')),
            footer: rect(card.querySelector('footer')),
            text: card.textContent.trim(),
          })),
        };
      })()`,
    );

    assert.equal(result.count, "2 則留言");
    assert(result.action.height > 100, "Guestbook action card collapsed");
    assert.equal(result.cards.length, 2);
    for (const [index, card] of result.cards.entries()) {
      assert(card.span > 1, `Message ${index + 1} has no masonry span`);
      assert(card.card.height > 200, `Message ${index + 1} collapsed to a thin strip`);
      assert(card.body.height > 100, `Message ${index + 1} body is not visible`);
      assert(card.paragraph.height > 20, `Message ${index + 1} text is not visible`);
      assert(card.footer.height > 20, `Message ${index + 1} footer is not visible`);
      assert(
        card.footer.bottom <= card.card.bottom + 1,
        `Message ${index + 1} footer overflows the card`,
      );
      assert(card.text.length > 10, `Message ${index + 1} content is missing`);
    }
    assert(
      result.grid.height >= Math.max(...result.cards.map((card) => card.card.bottom)) - result.grid.top,
      "Guestbook grid does not contain its cards",
    );
    console.log("Guestbook delayed-render Chrome layout check passed.");
  } catch (error) {
    if (viteOutput.length) {
      console.error(viteOutput.join(""));
    }
    throw error;
  } finally {
    client?.close();
    await stopProcess(chrome);
    await stopProcess(vite);
    if (proxy) {
      await new Promise((resolve) => proxy.close(() => resolve()));
    }
    if (userDataDirectory) {
      await rm(userDataDirectory, { recursive: true, force: true });
    }
  }
}

await main();
