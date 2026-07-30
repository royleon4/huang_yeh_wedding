import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Could not remove ${label}`);
  return next;
}

const adminPath = "artifacts/memories-album/src/client/AdminApp.jsx";
let admin = await readFile(adminPath, "utf8");

admin = replaceOnce(
  admin,
  /\n  const \[uploadInputKey, setUploadInputKey\] = useState\(0\);[\s\S]*?\n  const \[loading, setLoading\] = useState\(true\);/,
  "\n  const [loading, setLoading] = useState(true);",
  "legacy single-photo state",
);

admin = replaceOnce(
  admin,
  /  const pendingCount =\n    changeSet\.count \+ categoryVideoChanges\.length \+ \(upload\.file \? 1 : 0\);/,
  "  const pendingCount = changeSet.count + categoryVideoChanges.length;",
  "legacy upload pending count",
);

admin = replaceOnce(
  admin,
  /\n    setUpload\(\(current\) => \(\{[\s\S]*?\n    \}\)\);(?=\n  \};)/,
  "",
  "legacy upload normalization",
);

admin = replaceOnce(
  admin,
  /\n      if \(upload\.file\) \{[\s\S]*?\n      \}(?=\n\n      await loadCanonical)/,
  "",
  "legacy single-photo save branch",
);

admin = replaceOnce(
  admin,
  /\n  const loadMorePhotos = async \(\) => \{[\s\S]*?\n  \};(?=\n\n  const logout)/,
  "",
  "legacy photo pagination function",
);

admin = replaceOnce(
  admin,
  /        \{tab === "photos" && \([\s\S]*?\n        \)\}(?=\n      <\/main>)/,
  '        {tab === "photos" && (\n          <div data-admin-photo-workspace-placeholder />\n        )}',
  "legacy photo tab implementation",
);

admin = replaceOnce(
  admin,
  /\s*\|\|\s*Boolean\(upload\.file && upload\.albumIds\.length === 0\)/,
  "",
  "legacy upload save guard",
);

await writeFile(adminPath, admin);

const processPath = "artifacts/memories-album/process-content-ui-transform.mjs";
let processTransform = await readFile(processPath, "utf8");
processTransform = replaceOnce(
  processTransform,
  /\n  code = replaceOnce\(\n    code,\n    `                    value=\{upload\.categoryId\}[\s\S]*?"new-photo category clearing",\n  \);\n/,
  "\n",
  "dead transforms for replaced single-photo form",
);
await writeFile(processPath, processTransform);
