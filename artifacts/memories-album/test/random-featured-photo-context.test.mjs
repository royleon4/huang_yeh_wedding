import assert from "node:assert/strict";
import test from "node:test";
import { createFeaturedPhotoSelectionSession } from "../src/client/guest-featured-photos.mjs";

function photos(ids) {
  return ids.map((id) => ({ id }));
}

function overlap(left, right) {
  const rightIds = new Set(right);
  return left.filter((id) => rightIds.has(id));
}

test("switching process labels does not carry the previous random featured cards when alternatives exist", () => {
  const session = createFeaturedPhotoSelectionSession({ random: () => 0 });
  const common = {
    activeCollection: "wedding",
    enabled: true,
    minimum: 2,
    maximum: 2,
  };

  const entrance = session.select(
    photos(["shared-1", "shared-2", "entrance-1", "entrance-2"]),
    { ...common, activeFilter: "entrance" },
  );
  const beforeEntrance = session.select(
    photos(["shared-1", "shared-2", "before-1", "before-2"]),
    { ...common, activeFilter: "before-entrance" },
  );

  assert.equal(entrance.length, 2);
  assert.equal(beforeEntrance.length, 2);
  assert.deepEqual(overlap(entrance, beforeEntrance), []);
});

test("a process may reuse a previous featured photo only when its own candidates cannot fill the range otherwise", () => {
  const session = createFeaturedPhotoSelectionSession({ random: () => 0 });
  const common = {
    activeCollection: "wedding",
    enabled: true,
    minimum: 2,
    maximum: 2,
  };

  const first = session.select(photos(["first-only", "shared", "extra"]), {
    ...common,
    activeFilter: "first",
  });
  const second = session.select(photos(["shared", "second-only"]), {
    ...common,
    activeFilter: "second",
  });

  assert.equal(first.length, 2);
  assert.equal(second.length, 2);
  assert.equal(overlap(first, second).length, 1);
  assert.ok(second.includes("second-only"));
});

test("changing the candidate photos invalidates a cached random selection and refills the configured count", () => {
  const session = createFeaturedPhotoSelectionSession({ random: () => 0 });
  const options = {
    activeCollection: "wedding",
    activeFilter: "entrance",
    enabled: true,
    minimum: 2,
    maximum: 2,
  };

  const first = session.select(photos(["old-1", "old-2", "old-3"]), options);
  const refreshed = session.select(
    photos(["new-1", "new-2", "new-3"]),
    options,
  );

  assert.equal(first.length, 2);
  assert.equal(refreshed.length, 2);
  assert.deepEqual(overlap(first, refreshed), []);
  assert.ok(refreshed.every((id) => id.startsWith("new-")));
});

test("revisiting the same process in one page session keeps that process selection stable", () => {
  const session = createFeaturedPhotoSelectionSession({ random: () => 0 });
  const common = {
    activeCollection: "wedding",
    enabled: true,
    minimum: 2,
    maximum: 2,
  };
  const entrancePhotos = photos([
    "shared-1",
    "shared-2",
    "entrance-1",
    "entrance-2",
  ]);

  const firstVisit = session.select(entrancePhotos, {
    ...common,
    activeFilter: "entrance",
  });
  session.select(photos(["shared-1", "shared-2", "before-1", "before-2"]), {
    ...common,
    activeFilter: "before-entrance",
  });
  const revisit = session.select(entrancePhotos, {
    ...common,
    activeFilter: "entrance",
  });

  assert.deepEqual(revisit, firstVisit);
});
