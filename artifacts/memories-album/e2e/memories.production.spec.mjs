import { expect, test } from "@playwright/test";

function watchBrowserFailures(page) {
  const failures = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console.error: ${message.text()}`);
    }
  });

  return () => {
    expect(failures, failures.join("\n")).toEqual([]);
  };
}

async function mockPublicApis(page) {
  await page.route("**/Memories/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/health")) {
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith("/processes")) {
      return route.fulfill({
        json: {
          processes: [
            {
              id: "ceremony",
              labelZh: "婚禮儀式",
              labelEn: "Ceremony",
              displayOrder: 1,
              contentHtmlZh: "",
              contentHtmlEn: "",
            },
          ],
          allProcess: {
            labelZh: "全部流程",
            labelEn: "All moments",
            showAllPhotos: true,
          },
        },
      });
    }
    if (path.endsWith("/albums")) {
      return route.fulfill({
        json: {
          albums: [
            {
              id: "wedding",
              titleZh: "婚禮相簿",
              titleEn: "Wedding album",
              descriptionZh: "",
              descriptionEn: "",
              isVisible: true,
            },
          ],
        },
      });
    }
    if (path.includes("/photos")) {
      return route.fulfill({ json: { photos: [], nextCursor: null } });
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
      return route.fulfill({
        json: {
          albums: [
            {
              id: "wedding",
              titleZh: "婚禮相簿",
              titleEn: "Wedding album",
              descriptionZh: "",
              descriptionEn: "",
              isVisible: true,
              isSystem: false,
            },
          ],
        },
      });
    }
    if (path.endsWith("/categories")) {
      return route.fulfill({
        json: {
          categories: [
            {
              id: "ceremony",
              labelZh: "婚禮儀式",
              labelEn: "Ceremony",
              displayOrder: 1,
              youtubeUrl: "",
              youtubeAutoplay: false,
            },
          ],
        },
      });
    }
    if (path.includes("/photo-uploaders")) {
      return route.fulfill({ json: { uploaders: [] } });
    }
    if (path.includes("/photos")) {
      return route.fulfill({ json: { photos: [], nextCursor: null } });
    }
    return route.fulfill({ json: {} });
  });
}

for (const route of ["/Memories/", "/Memories/en/"]) {
  test(`production public route renders without browser errors: ${route}`, async ({ page }) => {
    const assertNoBrowserFailures = watchBrowserFailures(page);
    await mockPublicApis(page);

    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByText("婚禮相簿暫時發生問題")).toHaveCount(0);
    assertNoBrowserFailures();
  });
}

test("administrator login route renders without browser errors", async ({ page }) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  const response = await page.goto("/admin/login", { waitUntil: "networkidle" });

  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.getByText("婚禮相簿暫時發生問題")).toHaveCount(0);
  assertNoBrowserFailures();
});

test("administrator tabs render from the production bundle", async ({ page }) => {
  const assertNoBrowserFailures = watchBrowserFailures(page);
  await mockAdminApis(page);

  const response = await page.goto("/admin", { waitUntil: "networkidle" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "婚禮相簿管理" })).toBeVisible();

  const tabs = [
    ["相簿", "相簿"],
    ["照片", null],
    ["分類與影片", "婚禮流程分類與影片"],
  ];

  for (const [tabName, heading] of tabs) {
    await page.getByRole("button", { name: tabName, exact: true }).click();
    await expect(page.getByRole("button", { name: tabName, exact: true })).toHaveClass(/active/);
    if (heading) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByText("婚禮相簿暫時發生問題")).toHaveCount(0);
  }

  assertNoBrowserFailures();
});
