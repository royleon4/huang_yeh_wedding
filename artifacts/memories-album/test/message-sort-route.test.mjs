import assert from "node:assert/strict";
import test from "node:test";
import {
  messageSortModeFromSearch,
  messageSortRoute,
} from "../src/client/message-sort-route.mjs";

test("message sort query overrides the album default", () => {
  assert.equal(messageSortModeFromSearch("?sort=random", "time-desc"), "random");
  assert.equal(
    messageSortModeFromSearch("?sort=author-desc", "time-asc"),
    "author-desc",
  );
});

test("missing or invalid message sort query falls back safely", () => {
  assert.equal(messageSortModeFromSearch("", "time-desc"), "time-desc");
  assert.equal(
    messageSortModeFromSearch("?sort=unsupported", "name-asc"),
    "name-asc",
  );
  assert.equal(messageSortModeFromSearch("?sort=unsupported", "bad"), "time-asc");
});

test("message sort route preserves other query parameters and hash", () => {
  assert.equal(
    messageSortRoute(
      {
        pathname: "/Memories/albums/messages",
        search: "?demo=1&sort=time-asc",
        hash: "#guestbook",
      },
      "random",
    ),
    "/Memories/albums/messages?demo=1&sort=random#guestbook",
  );
});

test("message sort route always writes a normalized sort value", () => {
  assert.equal(
    messageSortRoute(
      {
        pathname: "/Memories/albums/messages",
        search: "?sort=random",
        hash: "",
      },
      "unsupported",
    ),
    "/Memories/albums/messages?sort=time-asc",
  );
});
