import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("guestbook masonry initializes inside the grid that mounts after loading", async () => {
  const album = await source("src/client/MessageAlbum.jsx");

  assert.match(album, /import useMasonryLayout from "\.\/useMasonryLayout\.mjs"/);
  assert.match(
    album,
    /function MessageGrid\([^)]*\) \{\s*const gridRef = useMasonryLayout\(\)/,
  );
  assert.match(
    album,
    /<div ref=\{gridRef\} className="masonry-grid message-grid">/,
  );
  assert.match(
    album,
    /loading \? \([\s\S]*?\) : error \? \([\s\S]*?\) : \(\s*<MessageGrid/,
  );
  assert.doesNotMatch(
    album,
    /export default function MessageAlbum[\s\S]*?const gridRef = useMasonryLayout\(\)/,
  );
  assert.match(album, /\(\) => `\$\{messages\.length\} \$\{t\.count\}`/);
});

test("guestbook submit has a synchronous duplicate-request guard", async () => {
  const modal = await source("src/client/MessageModal.jsx");

  assert.match(modal, /const submittingRef = useRef\(false\)/);
  assert.match(
    modal,
    /event\.preventDefault\(\);\s*if \(submittingRef\.current\) return;/,
  );
  assert.match(modal, /submittingRef\.current = true;\s*setBusy\(true\)/);
  assert.match(
    modal,
    /finally \{\s*submittingRef\.current = false;\s*controllerRef\.current = null;/,
  );
});

test("guestbook refreshes from the server after an optimistic creation", async () => {
  const album = await source("src/client/MessageAlbum.jsx");

  assert.match(
    album,
    /void loadMessages\(\{ showLoading: false, preserveOnError: true \}\)/,
  );
  assert.match(
    album,
    /current\.filter\(\(item\) => item\.id !== message\.id\)/,
  );
});

test("public and administrator guestbooks show date and time to the minute", async () => {
  const [album, panel] = await Promise.all([
    source("src/client/MessageAlbum.jsx"),
    source("src/client/AdminMessagesPanel.jsx"),
  ]);

  for (const code of [album, panel]) {
    assert.match(code, /year: "numeric"/);
    assert.match(code, /month: "short"/);
    assert.match(code, /day: "numeric"/);
    assert.match(code, /hour: "2-digit"/);
    assert.match(code, /minute: "2-digit"/);
    assert.doesNotMatch(code, /second: "2-digit"/);
  }
  assert.match(album, /localizedDateTime\(message\.messageAt, lang\)/);
  assert.match(panel, /formattedDateTime\(item\.messageAt\)/);
  assert.match(
    panel,
    /timeZoneOffsetMinutes: new Date\(\)\.getTimezoneOffset\(\)/,
  );
});

test("public and administrator guestbooks apply the album sort mode", async () => {
  const [album, panel] = await Promise.all([
    source("src/client/MessageAlbum.jsx"),
    source("src/client/AdminMessagesPanel.jsx"),
  ]);

  for (const code of [album, panel]) {
    assert.match(code, /sortAlbumMessages/);
    assert.match(code, /const \[messageRandomSeed\] = useState/);
  }
  assert.match(
    album,
    /sortAlbumMessages\(messages, selectedSortMode, messageRandomSeed\)/,
  );
  assert.match(album, /messages=\{orderedMessages\}/);
  assert.match(
    panel,
    /sortAlbumMessages\(messages, sortMode, messageRandomSeed\)/,
  );
  assert.match(panel, /orderedMessages\.map\(\(item\) =>/);
  assert.doesNotMatch(panel, /\{messages\.map\(\(item\) =>/);
});

test("public guestbook keeps the count and message sorting on one compact raised row", async () => {
  const [album, styles] = await Promise.all([
    source("src/client/MessageAlbum.jsx"),
    source("src/client/message-album.css"),
  ]);

  assert.match(album, /const \[selectedSortMode, setSelectedSortMode\] = useState/);
  assert.match(album, /setSelectedSortMode\(normalizeAlbumPhotoSortMode\(sortMode\)\)/);
  assert.match(
    album,
    /className="message-album-toolbar">\s*<div className="message-album-heading">\s*<span>\{countLabel\}<\/span>\s*<\/div>\s*<label className="message-sort-control">[\s\S]*?<\/label>\s*<\/div>/,
  );
  assert.doesNotMatch(album, /className="message-sort-row"/);
  assert.match(album, /aria-label=\{t\.sortLabel\}/);
  assert.match(album, /value=\{selectedSortMode\}/);
  assert.match(album, /隨機排列/);
  assert.match(album, /最新留言優先/);
  assert.match(album, /最早留言優先/);
  assert.match(album, /留言內容：正序/);
  assert.match(album, /留言內容：反序/);
  assert.match(album, /留言者姓名：正序/);
  assert.match(album, /留言者姓名：反序/);
  assert.match(album, /Newest messages first/);
  assert.match(album, /Oldest messages first/);
  assert.match(album, /Message text: A–Z/);
  assert.match(album, /Guest name: A–Z/);
  assert.match(
    styles,
    /\.message-album-toolbar[\s\S]*?justify-content: space-between[\s\S]*?margin: -1\.25rem 0 1rem/,
  );
  assert.match(
    styles,
    /\.message-sort-control select[\s\S]*?max-width: min\(16rem, 46vw\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 480px\)[\s\S]*?\.message-sort-control select[\s\S]*?max-width: 44vw/,
  );
});

test("administrator guestbook import keeps a stable form reference across awaits", async () => {
  const panel = await source("src/client/AdminMessagesPanel.jsx");

  assert.match(
    panel,
    /event\.preventDefault\(\);\s*const form = event\.currentTarget;/,
  );
  assert.match(panel, /form\.reset\(\)/);
  assert.doesNotMatch(panel, /event\.currentTarget\.reset\(\)/);
});

test("administrator guestbook exposes item and bulk moderation", async () => {
  const panel = await source("src/client/AdminMessagesPanel.jsx");
  const api = await source("src/server/messages/api.mjs");
  const repository = await source("src/server/messages/postgres-repository.mjs");

  assert.match(panel, /changeVisibility/);
  assert.match(panel, /隱藏 \/ Hide/);
  assert.match(panel, /重新顯示 \/ Show/);
  assert.match(panel, /永久刪除 \/ Delete/);
  assert.match(panel, /deleteAllMessages/);
  assert.match(panel, /永久刪除全部留言 \/ Delete all messages/);
  assert.match(panel, /window\.confirm/);
  assert.match(api, /request\.method === "PATCH"/);
  assert.match(api, /request\.method === "DELETE" && collectionPath/);
  assert.match(api, /INVALID_MESSAGE_VISIBILITY/);
  assert.match(repository, /async updateVisibility/);
  assert.match(repository, /async deleteMessage/);
  assert.match(repository, /async deleteAllMessages/);
});

test("bottom navigation assigns odd and even album positions around upload", async () => {
  const navigation = await source("src/client/BottomCollectionNav.jsx");

  assert.match(
    navigation,
    /const leftAlbums = albums\.filter\(\(_.*, index\) => index % 2 === 0\)/,
  );
  assert.match(
    navigation,
    /const rightAlbums = albums\.filter\(\(_.*, index\) => index % 2 === 1\)/,
  );
  assert.match(navigation, /albums=\{leftAlbums\}/);
  assert.match(navigation, /albums=\{rightAlbums\}/);
  assert.doesNotMatch(navigation, /albums\.slice\(/);
  assert.doesNotMatch(navigation, /const split =/);
});
