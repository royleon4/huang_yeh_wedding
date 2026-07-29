import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";

async function withServer(options, run) {
  const server = createServer(options);
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

test("SECRET_TOKEN login opens the protected /Memories/admin/ route", async () => {
  await withServer(
    {
      env: { SECRET_TOKEN: "correct-password" },
      getRuntime: async () => {
        throw new Error("The admin route must not initialize storage");
      },
    },
    async (origin) => {
      const anonymous = await fetch(`${origin}/Memories/admin/`, {
        redirect: "manual",
      });
      assert.equal(anonymous.status, 303);
      assert.equal(
        anonymous.headers.get("location"),
        "/Memories/admin/login",
      );

      const anonymousApi = await fetch(
        `${origin}/Memories/admin/api/albums`,
      );
      assert.equal(anonymousApi.status, 401);
      assert.equal((await anonymousApi.json()).code, "UNAUTHORIZED");

      const loginPage = await fetch(`${origin}/Memories/admin/login`);
      assert.equal(loginPage.status, 200);
      assert.match(loginPage.headers.get("content-type"), /^text\/html/);

      const rejected = await fetch(
        `${origin}/Memories/admin/api/session`,
        {
          method: "POST",
          headers: { Authorization: "Bearer wrong-password" },
        },
      );
      assert.equal(rejected.status, 401);

      const accepted = await fetch(
        `${origin}/Memories/admin/api/session`,
        {
          method: "POST",
          headers: { Authorization: "Bearer correct-password" },
        },
      );
      assert.equal(accepted.status, 200);
      assert.deepEqual(await accepted.json(), { authenticated: true });
      const setCookie = accepted.headers.get("set-cookie");
      assert.match(setCookie, /^memories_admin_session=/);
      assert.match(setCookie, /Path=\/Memories\/admin/i);
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      assert.match(setCookie, /SameSite=Strict/i);
      assert.doesNotMatch(setCookie, /correct-password/);

      const protectedPage = await fetch(`${origin}/Memories/admin/`, {
        headers: { Cookie: cookiePair(setCookie) },
      });
      assert.equal(protectedPage.status, 200);
      assert.match(protectedPage.headers.get("content-type"), /^text\/html/);
      assert.equal(protectedPage.headers.get("x-frame-options"), "DENY");
      assert.match(
        protectedPage.headers.get("content-security-policy"),
        /frame-ancestors 'none'/,
      );
      assert.match(
        protectedPage.headers.get("content-security-policy"),
        /style-src-attr 'unsafe-inline'/,
      );

      const session = await fetch(`${origin}/Memories/admin/api/session`, {
        headers: { Cookie: cookiePair(setCookie) },
      });
      assert.equal(session.status, 200);
      assert.deepEqual(await session.json(), { authenticated: true });

      const oldAdmin = await fetch(`${origin}/admin`, {
        redirect: "manual",
      });
      assert.equal(oldAdmin.status, 308);
      assert.equal(oldAdmin.headers.get("location"), "/Memories/admin/");

      const oldSession = await fetch(`${origin}/admin/api/session`, {
        redirect: "manual",
      });
      assert.equal(oldSession.status, 308);
      assert.equal(
        oldSession.headers.get("location"),
        "/Memories/admin/api/session",
      );

      const removedLegacyLogin = await fetch(
        `${origin}/Memories/api/admin/session`,
        { method: "POST" },
      );
      assert.equal(removedLegacyLogin.status, 404);
    },
  );
});

test("the nested production route retains login failure limits", async () => {
  await withServer(
    {
      env: {
        SECRET_TOKEN: "correct-password",
        REPLIT_DEPLOYMENT: "1",
      },
      getRuntime: async () => {
        throw new Error("Login must not initialize storage");
      },
    },
    async (origin) => {
      for (let index = 0; index < 5; index += 1) {
        const response = await fetch(
          `${origin}/Memories/admin/api/session`,
          {
            method: "POST",
            headers: {
              Authorization: "Bearer wrong-password",
              "X-Forwarded-For": "203.0.113.55",
            },
          },
        );
        assert.equal(response.status, 401);
      }
      const limited = await fetch(
        `${origin}/Memories/admin/api/session`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer correct-password",
            "X-Forwarded-For": "203.0.113.55",
          },
        },
      );
      assert.equal(limited.status, 429);

      const otherClient = await fetch(
        `${origin}/Memories/admin/api/session`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer correct-password",
            "X-Forwarded-For": "203.0.113.56",
          },
        },
      );
      assert.equal(otherClient.status, 200);
    },
  );
});
