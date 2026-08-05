import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist/public");
const manifestPath = path.join(root, ".vite/manifest.json");
const outputDirectory = path.resolve("dist/performance");
const enforce = process.argv.includes("--check");

const budgets = {
  entryGzipBytes: 450 * 1024,
  largestChunkGzipBytes: 800 * 1024,
  totalJavaScriptGzipBytes: 2 * 1024 * 1024,
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = (await listFiles(root)).filter((file) => /\.(?:js|css)$/.test(file));
const assets = [];
for (const file of files) {
  const content = await readFile(file);
  assets.push({
    file: relative(file),
    type: path.extname(file).slice(1),
    bytes: content.length,
    gzipBytes: gzipSync(content, { level: 9 }).length,
  });
}
assets.sort((left, right) => right.gzipBytes - left.gzipBytes);

const entryRecord = Object.entries(manifest).find(([, value]) => value.isEntry);
if (!entryRecord) throw new Error("Vite bundle manifest has no entry chunk");
const [entrySource, entryMetadata] = entryRecord;
const entryAsset = assets.find((asset) => asset.file === entryMetadata.file);
if (!entryAsset) throw new Error(`Entry asset not found: ${entryMetadata.file}`);

const dynamicImports = new Set(entryMetadata.dynamicImports ?? []);
const requiredPrivateChunks = [
  "src/client/AdminApp.jsx",
  "src/client/AdminLoginPage.jsx",
  "src/client/BatchManagementPage.jsx",
];
const missingPrivateChunks = requiredPrivateChunks.filter(
  (source) => !dynamicImports.has(source),
);

const javascriptAssets = assets.filter((asset) => asset.type === "js");
const largestChunk = javascriptAssets[0] ?? { gzipBytes: 0, file: null };
const totalJavaScriptGzipBytes = javascriptAssets.reduce(
  (total, asset) => total + asset.gzipBytes,
  0,
);

const failures = [];
if (entryAsset.gzipBytes > budgets.entryGzipBytes) {
  failures.push(
    `Entry chunk ${entryAsset.file} is ${entryAsset.gzipBytes} gzip bytes; budget is ${budgets.entryGzipBytes}`,
  );
}
if (largestChunk.gzipBytes > budgets.largestChunkGzipBytes) {
  failures.push(
    `Largest chunk ${largestChunk.file} is ${largestChunk.gzipBytes} gzip bytes; budget is ${budgets.largestChunkGzipBytes}`,
  );
}
if (totalJavaScriptGzipBytes > budgets.totalJavaScriptGzipBytes) {
  failures.push(
    `Total JavaScript is ${totalJavaScriptGzipBytes} gzip bytes; budget is ${budgets.totalJavaScriptGzipBytes}`,
  );
}
if (missingPrivateChunks.length > 0) {
  failures.push(
    `Private route modules are not dynamic imports: ${missingPrivateChunks.join(", ")}`,
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  entrySource,
  entry: entryAsset,
  largestChunk,
  totalJavaScriptGzipBytes,
  dynamicImports: [...dynamicImports].sort(),
  budgets,
  failures,
  assets,
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, "bundle-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
await writeFile(
  path.join(outputDirectory, "bundle-report.md"),
  [
    "# Memories bundle report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Entry: \`${entryAsset.file}\` — ${entryAsset.gzipBytes} gzip bytes`,
    `- Largest JavaScript chunk: \`${largestChunk.file}\` — ${largestChunk.gzipBytes} gzip bytes`,
    `- Total JavaScript: ${totalJavaScriptGzipBytes} gzip bytes`,
    `- Private dynamic imports: ${requiredPrivateChunks.length - missingPrivateChunks.length}/${requiredPrivateChunks.length}`,
    "",
    failures.length === 0
      ? "Result: PASS"
      : `Result: FAIL\n\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
    "",
  ].join("\n"),
);

console.log(JSON.stringify(report, null, 2));
if (enforce && failures.length > 0) {
  process.exitCode = 1;
}
