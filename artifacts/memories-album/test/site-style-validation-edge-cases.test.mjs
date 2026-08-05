import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SITE_STYLE,
  isValidSiteStyle,
  normalizeSiteStyle,
} from "../src/site-style.mjs";

function completeStyle(overrides = {}) {
  return { ...DEFAULT_SITE_STYLE, ...overrides };
}

test("missing or blank overlay opacity uses the documented default", () => {
  for (const value of [undefined, null, ""]) {
    assert.equal(
      normalizeSiteStyle({ heroOverlayOpacity: value }).heroOverlayOpacity,
      DEFAULT_SITE_STYLE.heroOverlayOpacity,
    );
  }
  assert.equal(normalizeSiteStyle({ heroOverlayOpacity: 0 }).heroOverlayOpacity, 0);
});

test("site style validation requires a real numeric opacity", () => {
  assert.equal(isValidSiteStyle(completeStyle({ heroOverlayOpacity: 0 })), true);
  for (const value of ["0", "", null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isValidSiteStyle(completeStyle({ heroOverlayOpacity: value })), false);
  }
});
