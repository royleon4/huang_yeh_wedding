import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mediaUrl = new URL(
  "../src/client/TiptapMediaNodes.jsx",
  import.meta.url,
);

function declarationIndex(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\bfunction\\s+${escaped}\\s*\\(`),
    new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\b`),
    new RegExp(`import\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}\\s*from`),
  ];

  const indexes = patterns
    .map((pattern) => source.search(pattern))
    .filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

test("every Tiptap parseHTML callback is declared before schema creation", async () => {
  const media = await readFile(mediaUrl, "utf8");
  const callbacks = [
    ...media.matchAll(/getAttrs:\s*([A-Za-z_$][\w$]*)/g),
  ];

  assert.ok(callbacks.length > 0, "expected at least one parseHTML callback");

  for (const callback of callbacks) {
    const name = callback[1];
    const declaration = declarationIndex(media, name);
    assert.notEqual(
      declaration,
      -1,
      `parseHTML callback ${name} must have a declaration or import`,
    );
    assert.ok(
      declaration < callback.index,
      `parseHTML callback ${name} must be declared before it is registered`,
    );
  }
});

test("the retained wedding-image parser reads figure and img attributes", async () => {
  const media = await readFile(mediaUrl, "utf8");

  assert.match(media, /function readImageAttributes\(element\)/);
  assert.match(media, /tagName[\s\S]*?toUpperCase\(\) === "IMG"/);
  assert.match(media, /querySelector\?\.\("img"\)/);
  assert.match(media, /querySelector\?\.\("figcaption"\)/);
  assert.match(media, /getAttribute\?\.\("data-width"\)/);
  assert.match(media, /width: clampMediaWidth\(width\)/);

  const registrations = media.match(/getAttrs: readImageAttributes/g) ?? [];
  assert.equal(
    registrations.length,
    2,
    "figure and standalone img parsing must both use the retained callback",
  );
});
