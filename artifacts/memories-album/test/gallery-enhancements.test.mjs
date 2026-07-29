import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  advanceAdminTitleTap,
  adminEntryDestination,
  masonryRowSpan,
} from "../src/client/gallery-enhancement-model.mjs";

test("five title taps inside the window trigger the hidden admin entry", () => {
  let state = { count: 0, lastTap: 0 };
  for (let index = 0; index < 4; index += 1) {
    state = advanceAdminTitleTap(state, 1_000 + index * 500);
    assert.equal(state.triggered, false);
  }
  state = advanceAdminTitleTap(state, 3_000);
  assert.equal(state.triggered, true);
  assert.equal(state.count, 0);
});

test("title tap counting resets after the allowed window", () => {
  let state = advanceAdminTitleTap({ count: 0, lastTap: 0 }, 1_000);
  state = advanceAdminTitleTap(state, 5_000);
  assert.deepEqual(state, { count: 1, lastTap: 5_000, triggered: false });
});

test("admin entry opens admin only for a valid session", async () => {
  const authenticated = await adminEntryDestination({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ authenticated: true }),
    }),
  });
  const anonymous = await adminEntryDestination({
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
  });

  assert.equal(authenticated, "/admin");
  assert.equal(anonymous, "/admin/login");
});

test("admin entry falls back to login when the session check hangs", async () => {
  const destination = await adminEntryDestination({
    fetchImpl: () => new Promise(() => {}),
    timeoutMs: 5,
  });
  assert.equal(destination, "/admin/login");
});

test("masonry row spans cover the rendered card height", () => {
  assert.equal(masonryRowSpan(100, 8, 10), 7);
  assert.equal(masonryRowSpan(0, 8, 10), 1);
  assert.equal(masonryRowSpan(250, 8, 10), 15);
});

test("Memories hides the redundant nav and wires delegated title taps", async () => {
  const css = await readFile(
    new URL("../src/client/gallery-tweaks.css", import.meta.url),
    "utf8",
  );
  const enhancement = await readFile(
    new URL("../src/client/GalleryEnhancements.jsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.primary-nav\s*\{[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /grid-auto-rows:\s*8px/);
  assert.match(enhancement, /\.archive-header h1/);
  assert.match(enhancement, /adminEntryDestination/);
  assert.match(enhancement, /masonryRowSpan/);
});
