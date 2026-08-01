import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";
import {
  cookiePair,
  withListeningServer,
} from "../test-support/http.mjs";

const ADMIN_TOKEN = "correct-password";

function storageMustRemainLazy() {
  throw new Error("Administrator routing must not initialize storage");
}

function withAdminApp(run, { env = { MEMORIES_ADMIN_TOKEN: ADMIN_TOKEN } } = {}) {
  return withListeningServer(
    createServer({ env, getRuntime: storageMustRemainLazy }),
    run,
  );
}

function sessionRequest(origin, { method = "POST", password } = {}) {
  const headers = password
    ? { Authorization: `Bearer ${password}` }
    : undefined;
  return fetch(`${origin}/Memories/admin/api/session`, { method, headers });
}

test("anonymous administrator routes require login", async () => {
  await withAdminApp(async (origin) => {
    const page = await fetch(`${origin}/Memories/admin/`, {
      redirect: "manual",
    });
    assert.equal(page.status, 303);
    assert.equal(page.headers.get("location"), "/Memories/admin/login");

    const api = await fetch(`${origin}/Memories/admin/api/albums`);
    assert.equal(api.status, 401);
    assert.equal((await api.json()).code, "UNAUTHORIZED");

    const loginPage = await fetch(`${origin}/Memories/admin/login`);
    assert.equal(loginPage.status, 200);
    assert.match(loginPage.headers.get("content-type") ?? "", /^text\/html/);
  });
});

test("administrator session failures stay explicit and bounded", async (t) => {
  await t.test("rejects an invalid password", async () => {
    await withAdminApp(async (origin) => {
      const response = await sessionRequest(origin, {
        password: "wrong-password",
      });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, "UNAUTHORIZED");
    });
  });

  await t.test("reports missing administrator configuration", async () => {
    await withAdminApp(
      async (origin) => {
        const response = await sessionRequest(origin, {
          password: "any-password",
        });
        assert.equal(response.status, 503);
        assert.equal(
          (await response.json()).code,
          "ADMIN_TOKEN_NOT_CONFIGURED",
        );
      },
      { env: {} },
    );
  });

  await t.test("rejects unsupported session methods", async () => {
    await withAdminApp(async (origin) => {
      const response = await sessionRequest(origin, { method: "PUT" });
      assert.equal(response.status, 405);
    });
  });
});

test("a valid session opens the protected administrator surface", async () => {
  await withAdminApp(async (origin) => {
    const accepted = await sessionRequest(origin, { password: ADMIN_TOKEN });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { authenticated: true });

    const setCookie = accepted.headers.get("set-cookie");
    assert.match(setCookie ?? "", /^memories_admin_session=/);
    assert.match(setCookie ?? "", /Path=\/Memories\/admin/i);
    assert.match(setCookie ?? "", /HttpOnly/i);
    assert.match(setCookie ?? "", /Secure/i);
    assert.match(setCookie ?? "", /SameSite=Strict/i);
    assert.doesNotMatch(setCookie ?? "", new RegExp(ADMIN_TOKEN));

    const cookie = cookiePair(setCookie);
    const protectedPage = await fetch(`${origin}/Memories/admin/`, {
      headers: { Cookie: cookie },
    });
    assert.equal(protectedPage.status, 200);
    assert.match(
      protectedPage.headers.get("content-type") ?? "",
      /^text\/html/,
    );
    assert.equal(protectedPage.headers.get("x-frame-options"), "DENY");
    assert.match(
      protectedPage.headers.get("content-security-policy") ?? "",
      /frame-ancestors 'none'/,
    );
    assert.match(
      protectedPage.headers.get("content-security-policy") ?? "",
      /style-src-attr 'unsafe-inline'/,
    );

    const session = await fetch(`${origin}/Memories/admin/api/session`, {
      headers: { Cookie: cookie },
    });
    assert.equal(session.status, 200);
    assert.deepEqual(await session.json(), { authenticated: true });
  });
});

test("legacy administrator routes redirect without restoring removed APIs", async () => {
  await withAdminApp(async (origin) => {
    const redirects = [
      ["/admin", "/Memories/admin/"],
      ["/admin/api/session", "/Memories/admin/api/session"],
    ];

    for (const [requestPath, location] of redirects) {
      const response = await fetch(`${origin}${requestPath}`, {
        redirect: "manual",
      });
      assert.equal(response.status, 308, requestPath);
      assert.equal(response.headers.get("location"), location, requestPath);
    }

    const removedLegacyLogin = await fetch(
      `${origin}/Memories/api/admin/session`,
      { method: "POST" },
    );
    assert.equal(removedLegacyLogin.status, 404);
  });
});
