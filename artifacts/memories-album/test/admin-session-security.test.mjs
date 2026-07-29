import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  adminAuthorized,
  adminPasswordMatches,
} from "../src/server/admin/auth.mjs";
import { createFixedWindowRateLimiter } from "../src/server/admin/rate-limit.mjs";
import { createAdminSessionApi } from "../src/server/admin/session-api.mjs";

async function withApi(api, run) {
  const server = createServer((request, response) => {
    if (!api(request, response)) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function cookiePair(setCookie) {
  return setCookie.split(";", 1)[0];
}

test("admin login exchanges the password for a short-lived secure cookie", async () => {
  let now = Date.parse("2026-06-20T00:00:00.000Z");
  const api = createAdminSessionApi({
    adminToken: "correct-password",
    now: () => now,
    ttlMs: 30 * 60 * 1000,
    createNonce: () => "fixed-nonce",
    rateLimiter: { consume: () => ({ allowed: true }) },
  });

  await withApi(api, async (origin) => {
    const login = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-password" },
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), {
      authenticated: true,
      expiresInSeconds: 1800,
    });

    const setCookie = login.headers.get("set-cookie");
    assert.match(setCookie, /^memories_admin_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Path=\/Memories/i);
    assert.doesNotMatch(setCookie, /correct-password/);

    const request = {
      headers: { cookie: cookiePair(setCookie) },
    };
    assert.equal(
      adminAuthorized(request, "correct-password", { now: () => now }),
      true,
    );
    now += 30 * 60 * 1000 + 1;
    assert.equal(
      adminAuthorized(request, "correct-password", { now: () => now }),
      false,
    );
  });
});

test("raw passwords are accepted only by the login exchange", () => {
  assert.equal(
    adminPasswordMatches(
      { headers: { authorization: "Bearer correct-password" } },
      "correct-password",
    ),
    true,
  );
  assert.equal(
    adminAuthorized(
      { headers: { authorization: "Bearer correct-password" } },
      "correct-password",
    ),
    false,
  );
});

test("sign out clears the administrator cookie", async () => {
  const api = createAdminSessionApi({
    adminToken: "correct-password",
    rateLimiter: { consume: () => ({ allowed: true }) },
  });
  await withApi(api, async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "DELETE",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: false });
    assert.match(
      response.headers.get("set-cookie"),
      /^memories_admin_session=;.*Max-Age=0/i,
    );
  });
});

test("login attempts are rate limited without echoing credentials", async () => {
  let now = 0;
  const limiter = createFixedWindowRateLimiter({
    limit: 2,
    windowMs: 60_000,
    now: () => now,
  });
  const api = createAdminSessionApi({
    adminToken: "correct-password",
    rateLimiter: limiter,
  });

  await withApi(api, async (origin) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const rejected = await fetch(`${origin}/Memories/api/admin/session`, {
        method: "POST",
        headers: { Authorization: "Bearer wrong-password" },
      });
      assert.equal(rejected.status, 401);
    }
    const limited = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-password" },
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.deepEqual(await limited.json(), {
      error: "Too many administrator requests",
      code: "RATE_LIMITED",
    });

    now += 60_000;
    const recovered = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-password" },
    });
    assert.equal(recovered.status, 200);
  });
});
