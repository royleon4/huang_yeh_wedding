import { expect, test } from "@playwright/test";
import { crossBrowserAdminToken } from "../playwright.config.mjs";

const imagePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAIAAADkharWAAAAF0lEQVR4nGO8c+MUAymAiSTVoxpGkAYA0qUCllQl2T0AAAAASUVORK5CYII=",
  "base64",
);

const albums = [
  {
    id: "wedding",
    titleZh: "婚禮流程",
    titleEn: "Wedding moments",
    descriptionZh: "婚禮當天的流程與回憶",
    descriptionEn: "Moments from the wedding day",
    displayOrder: 1,
    albumType: "album",
    isVisible: true,
    showSummary: true,
    photoSortMode: "captured-asc",
  },
  {
    id: "life",
    titleZh: "生活照",
    titleEn: "Life photos",
    descriptionZh: "婚禮以外的日常片刻",
    descriptionEn: "Everyday memories outside the wedding",
    displayOrder: 2,
    albumType: "album",
    isVisible: true,
    showSummary: true,
    photoSortMode: "captured-desc",
  },
  {
    id: "guest",
    titleZh: "訪客上傳",
    titleEn: "Guest uploads",
    descriptionZh: "賓客分享的照片",
    descriptionEn: "Photos shared by our guests",
    displayOrder: 3,
    albumType: "album",
    isVisible: true,
    showSummary: true,
    photoSortMode: "captured-desc",
  },
  {
    id: "messages",
    titleZh: "留言區",
    titleEn: "Guestbook",
    descriptionZh: "留下給我們的祝福",
    descriptionEn: "Leave us a blessing",
    displayOrder: 4,
    albumType: "message",
    isVisible: true,
    showSummary: true,
    photoSortMode: "captured-desc",
  },
];

const processes = [
  {
    id: "announcement",
    albumId: "wedding",
    labelZh: "宣佈",
    labelEn: "Announcement",
    displayOrder: 1,
    youtubeVideoId: "dQw4w9WgXcQ",
    youtubeAutoplay: false,
    contentHtmlZh:
      '<h2>宣佈</h2><p>這是一段用來驗證中英文長文字、連結與內容寬度的跨瀏覽器測試內容。</p><p><a href="https://example.com">查看婚禮資訊</a></p>',
    contentHtmlEn:
      '<h2>Announcement</h2><p>This content verifies long bilingual text, links, and responsive content width across browser engines.</p>',
    dividerPaddingTop: 12,
    dividerPaddingBottom: 12,
  },
  {
    id: "daily",
    albumId: "life",
    labelZh: "日常生活與旅行回憶",
    labelEn: "Everyday life and travel memories",
    displayOrder: 1,
    youtubeVideoId: null,
    youtubeAutoplay: false,
    contentHtmlZh: "",
    contentHtmlEn: "",
    dividerPaddingTop: 12,
    dividerPaddingBottom: 12,
  },
];

const allProcess = {
  id: "all",
  labelZh: "全部婚禮流程",
  labelEn: "All wedding moments",
  youtubeVideoId: "dQw4w9WgXcQ",
  youtubeAutoplay: false,
  showAllPhotos: true,
  contentHtmlZh:
    '<h2>全部婚禮流程</h2><p>所有流程的說明應該保持在可視範圍內，不產生水平捲動。</p>',
  contentHtmlEn:
    '<h2>All wedding moments</h2><p>All process content must remain inside the visible viewport without horizontal scrolling.</p>',
  dividerPaddingTop: 12,
  dividerPaddingBottom: 12,
};

const photos = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    displayName: "婚禮宣佈",
    capturedAt: "2026-06-20T03:00:00.000Z",
    createdAt: "2026-06-20T03:00:00.000Z",
    thumbnailUrl:
      "/Memories/api/photos/00000000-0000-4000-8000-000000000001/thumbnail",
    originalUrl:
      "/Memories/api/photos/00000000-0000-4000-8000-000000000001/original",
    albumIds: ["wedding"],
    processIds: ["announcement"],
    uploaderName: "婚禮攝影",
    source: "admin",
    width: 1200,
    height: 800,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    displayName: "生活照",
    capturedAt: "2026-06-21T03:00:00.000Z",
    createdAt: "2026-06-21T03:00:00.000Z",
    thumbnailUrl:
      "/Memories/api/photos/00000000-0000-4000-8000-000000000002/thumbnail",
    originalUrl:
      "/Memories/api/photos/00000000-0000-4000-8000-000000000002/original",
    albumIds: ["life"],
    processIds: ["daily"],
    uploaderName: "Leon",
    source: "admin",
    width: 800,
    height: 1200,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    displayName: "訪客照片",
    capturedAt: "2026-06-22T03:00:00.000Z",
    createdAt: "2026-06-22T03:00:00.000Z",
    thumbnailUrl:
      "/Memories/api/photos/00000000-0000-4000-8000-000000000003/thumbnail",
    originalUrl:
      "/Memories/api/photos/00000000-0000-4000-8000-000000000003/original",
    albumIds: ["guest"],
    processIds: [],
    uploaderName: "一位名字非常長的婚禮訪客",
    source: "guest",
    width: 1200,
    height: 800,
  },
];

const messages = [
  {
    id: "00000000-0000-4000-8000-000000000010",
    albumId: "messages",
    visitorName: "一位名字很長的訪客",
    body: "願你們的家庭充滿平安與喜樂。這是一段用來驗證不同瀏覽器長文字換行的留言。",
    messageAt: "2026-06-20T04:30:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    albumId: "messages",
    visitorName: "Guest with a long name",
    body: "May your new journey be filled with grace, joy, and many wonderful memories together.",
    messageAt: "2026-06-20T05:30:00.000Z",
  },
];

function watchBrowserFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console.error: ${message.text()}`);
    }
  });
  return () => expect(failures, failures.join("\n")).toEqual([]);
}

async function mockPublicApis(page) {
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>YouTube fixture</title>",
    }),
  );

  await page.route("**/Memories/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === "/Memories/api/albums") {
      return route.fulfill({ json: { albums } });
    }
    if (path === "/Memories/api/settings/messages") {
      return route.fulfill({ json: { messages } });
    }
    if (path === "/Memories/api/settings") {
      return route.fulfill({
        json: {
          processWheelEnabled: false,
          processWheelVisibleCount: 6,
          processWheelLoopAlbumIds: [],
          galleryMediaOrder: ["video", "text", "weddingPhotos", "guestPhotos"],
          guestUploadCategorySelectionEnabled: true,
          siteCopy: {
            zh: { archive: "詠葉婚禮照片檔案館" },
            en: { archive: "The Leon and YehYeh Wedding Archive" },
          },
        },
      });
    }
    if (path === "/Memories/api/processes") {
      return route.fulfill({ json: { processes, allProcess } });
    }
    if (path === "/Memories/api/photos") {
      return route.fulfill({ json: { photos, nextCursor: null } });
    }
    if (path.includes("/thumbnail") || path.includes("/original")) {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: imagePng,
      });
    }
    if (path === "/Memories/api/health") {
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: {} });
  });
}

async function mockAdminApis(page) {
  await page.route("**/Memories/admin/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/session")) {
      return route.fulfill({ json: { authenticated: true } });
    }
    if (path.endsWith("/albums")) {
      return route.fulfill({ json: { albums } });
    }
    if (path.endsWith("/categories")) {
      return route.fulfill({ json: { categories: processes } });
    }
    if (path.includes("/photo-uploaders")) {
      return route.fulfill({ json: { uploaders: ["婚禮攝影", "Leon"] } });
    }
    if (path.includes("/photos")) {
      return route.fulfill({ json: { photos, nextCursor: null } });
    }
    if (path.includes("/messages")) {
      return route.fulfill({ json: { messages } });
    }
    if (path.includes("/settings")) {
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: {} });
  });
}

async function openPublic(page, route = "/Memories/") {
  await mockPublicApis(page);
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator(".bottom-collection-nav")).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const value = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(value.scrollWidth, JSON.stringify(value)).toBeLessThanOrEqual(
    value.clientWidth + 1,
  );
  expect(value.bodyScrollWidth, JSON.stringify(value)).toBeLessThanOrEqual(
    value.clientWidth + 1,
  );
}

async function navGeometry(page) {
  return page.locator(".bottom-collection-nav").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
    };
  });
}

async function expectVisibleElementsInsideViewport(page, selectors) {
  const failures = await page.evaluate((requestedSelectors) => {
    const viewportWidth = document.documentElement.clientWidth;
    return requestedSelectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { selector, left: rect.left, right: rect.right, viewportWidth };
        })
        .filter((rect) => rect.left < -1 || rect.right > viewportWidth + 1),
    );
  }, selectors);
  expect(failures, JSON.stringify(failures)).toEqual([]);
}

test("mobile public navigation stays on the visible viewport while scrolling", async ({
  page,
}) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublic(page);

  const before = await navGeometry(page);
  expect(before.position).toBe("fixed");
  expect(Math.abs(before.bottom - before.viewportHeight)).toBeLessThanOrEqual(1.5);
  expect(before.documentHeight).toBeGreaterThan(before.viewportHeight);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const after = await navGeometry(page);
  expect(after.position).toBe("fixed");
  expect(Math.abs(after.bottom - after.viewportHeight)).toBeLessThanOrEqual(1.5);
  await expectNoHorizontalOverflow(page);
  assertNoBrowserFailures();
});

test("responsive navigation keeps the established 700 and 720 pixel boundary", async ({
  page,
}) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  await mockPublicApis(page);

  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/Memories/", { waitUntil: "networkidle" });
  await expect(page.locator(".bottom-collection-nav")).toBeVisible();
  expect((await navGeometry(page)).position).toBe("fixed");
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 720, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  const desktop = await navGeometry(page);
  expect(desktop.position).toBe("sticky");
  expect(desktop.left).toBeGreaterThanOrEqual(-1);
  expect(desktop.right).toBeLessThanOrEqual(desktop.viewportWidth + 1);
  await expectNoHorizontalOverflow(page);
  assertNoBrowserFailures();
});

test("desktop sidebar, process content, video, and photos do not overlap or overflow", async ({
  page,
}) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPublic(page);

  expect((await navGeometry(page)).position).toBe("sticky");
  const geometry = await page.evaluate(() => {
    const nav = document.querySelector(".bottom-collection-nav").getBoundingClientRect();
    const header = document.querySelector(".archive-header").getBoundingClientRect();
    const main = document.querySelector("main").getBoundingClientRect();
    return { navRight: nav.right, headerLeft: header.left, mainLeft: main.left };
  });
  expect(geometry.headerLeft).toBeGreaterThanOrEqual(geometry.navRight - 1);
  expect(geometry.mainLeft).toBeGreaterThanOrEqual(geometry.navRight - 1);

  await expectVisibleElementsInsideViewport(page, [
    ".process-section",
    ".process-strip",
    ".process-video-block",
    ".process-video-block iframe",
    ".process-rich-content",
    ".photo-card",
  ]);
  await expectNoHorizontalOverflow(page);
  assertNoBrowserFailures();
});

test("long bilingual labels and the guestbook remain inside mobile width", async ({
  page,
}) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublic(page, "/Memories/en/");

  await expectVisibleElementsInsideViewport(page, [
    ".process-strip",
    ".process-chip",
    ".bottom-collection-nav",
    ".bottom-nav-side button",
  ]);

  await page.getByRole("button", { name: /Guestbook/i }).click();
  await expect(page.locator(".message-album")).toBeVisible();
  await expect(page.locator(".message-card")).toHaveCount(messages.length);
  await expectVisibleElementsInsideViewport(page, [
    ".message-album",
    ".message-album-toolbar",
    ".message-card",
  ]);
  await expectNoHorizontalOverflow(page);
  assertNoBrowserFailures();
});

test("administrator surface remains usable without horizontal overflow", async ({
  page,
}) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const login = await page.request.post("/Memories/admin/api/session", {
    headers: { Authorization: `Bearer ${crossBrowserAdminToken}` },
  });
  expect(login.ok()).toBeTruthy();
  await mockAdminApis(page);

  const response = await page.goto("/Memories/admin/albums", {
    waitUntil: "networkidle",
  });
  expect(response?.ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "婚禮相簿管理" }),
  ).toBeVisible();
  await expect(page.locator(".admin-tabs")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  assertNoBrowserFailures();
});
