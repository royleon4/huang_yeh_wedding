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

test("administrator guestbook keeps all messages folded and loads on first open", async () => {
  const panel = await source("src/client/AdminMessagesPanel.jsx");

  assert.match(panel, /const \[loading, setLoading\] = useState\(false\)/);
  assert.match(
    panel,
    /const \[messagesLoaded, setMessagesLoaded\] = useState\(false\)/,
  );
  assert.match(panel, /const loadInFlightRef = useRef\(false\)/);
  assert.doesNotMatch(panel, /useEffect/);
  assert.match(
    panel,
    /const handleMessagesToggle = \(event\) => \{[\s\S]*?const open = event\.currentTarget\.open;[\s\S]*?if \(open && !messagesLoaded && !loadInFlightRef\.current\) \{[\s\S]*?void load\(\);/,
  );
  assert.match(
    panel,
    /<details\s+className="admin-accordion admin-message-list-accordion"\s+onToggle=\{handleMessagesToggle\}\s*>/,
  );
  assert.doesNotMatch(
    panel,
    /<details[^>]*admin-message-list-accordion[^>]*\sopen(?:=|\s|>)/,
  );
  assert.match(panel, /所有留言 \/ All messages/);
  assert.match(panel, /開啟後載入 \/ Load on open/);
  assert.match(panel, /正在載入留言… \/ Loading messages…/);
});

test("administrator guestbook isolates bulk deletion in a red danger zone", async () => {
  const [panel, styles] = await Promise.all([
    source("src/client/AdminMessagesPanel.jsx"),
    source("src/client/admin-messages.css"),
  ]);

  assert.match(
    panel,
    /<\/details>\s*<section\s+className="admin-message-danger-zone"/,
  );
  assert.match(panel, /危險區 \/ Danger zone/);
  assert.match(
    panel,
    /className="button admin-permanent-delete admin-message-delete-all"/,
  );
  assert.match(panel, /永久刪除全部留言 \/ Delete all messages/);
  assert.match(panel, /!messagesLoaded \|\|[\s\S]*?messages\.length === 0/);
  assert.match(
    styles,
    /\.admin-message-danger-zone \{[\s\S]*?border: 1px solid var\(--admin-danger\);[\s\S]*?background: #f7dfda;/,
  );
  assert.match(
    styles,
    /\.admin-message-delete-all \{[\s\S]*?flex: 0 0 auto;/,
  );
});
