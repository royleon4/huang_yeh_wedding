import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const testDirectory = path.join(packageRoot, "test");
const packagePrefix = "artifacts/memories-album/";
const testPrefix = `${packagePrefix}test/`;

const DOCUMENTATION_FILE = /\.(?:md|mdx|txt)$/i;
const TEST_FILE = /\.test\.mjs$/i;

const FULL_AND_BUILD_FILES = new Set([
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".github/workflows/memories-ci.yml",
  ".github/workflows/memories-fast-ci.yml",
  `${packagePrefix}package.json`,
  `${packagePrefix}vite.routes.config.js`,
  `${packagePrefix}scripts/build.mjs`,
  `${packagePrefix}scripts/ensure-build-dependencies.mjs`,
  `${packagePrefix}src/app.mjs`,
  `${packagePrefix}src/server/runtime.mjs`,
]);

const GUESTBOOK_FILE = /(?:^|\/)(?:MessageAlbum\.jsx|MessageModal\.jsx|AdminMessagesPanel\.jsx|message-album\.css|admin-messages\.css|message-album-ui-transform\.mjs|album-photo-order\.mjs|messages\/)/;
const GUESTBOOK_BROWSER_FILE = /(?:^|\/)(?:MessageAlbum\.jsx|MessageModal\.jsx|message-album\.css|message-album-ui-transform\.mjs|verify-guestbook-layout\.mjs)$/;
const NAVIGATION_FILE = /(?:^|\/)(?:BottomCollectionNav\.jsx|bottom-collection-nav\.css|content-navigation|process-wheel|ProcessSelector|verify-navigation-layout\.mjs)/;
const NAVIGATION_BROWSER_FILE = /(?:^|\/)(?:BottomCollectionNav\.jsx|bottom-collection-nav\.css|content-navigation|process-wheel|ProcessSelector|verify-navigation-layout\.mjs)/;
const MIGRATION_FILE = /(?:^|\/)(?:migrations?|migrate)\b/i;

const TEST_GROUPS = {
  guestbook: [
    /\/test\/album-photo-order\.test\.mjs$/,
    /\/test\/message-.*\.test\.mjs$/,
    /\/test\/postgres-message-moderation\.test\.mjs$/,
  ],
  navigation: [
    /\/test\/.*(?:navigation|wheel|route).*\.test\.mjs$/,
    /\/test\/public-layout-polish\.test\.mjs$/,
    /\/test\/message-album-layout-regressions\.test\.mjs$/,
  ],
  migrations: [
    /\/test\/.*(?:migration|postgres).*\.test\.mjs$/,
    /\/test\/message-api\.test\.mjs$/,
  ],
};

function normalizeFiles(files) {
  return [...new Set(files.map((file) => String(file).trim()).filter(Boolean))]
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
}

function combineBrowser(current, next) {
  if (current === "all" || next === "none") return current;
  if (current === "none") return next;
  return current === next ? current : "all";
}

function addGroupTests(selected, availableTests, group) {
  for (const testPath of availableTests) {
    if (TEST_GROUPS[group].some((pattern) => pattern.test(testPath))) {
      selected.add(testPath);
    }
  }
}

export function discoverAvailableTests() {
  return readdirSync(testDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TEST_FILE.test(entry.name))
    .map((entry) => `${testPrefix}${entry.name}`)
    .sort();
}

export function selectTestsForFiles(files, availableTests = discoverAvailableTests()) {
  const changedFiles = normalizeFiles(files);
  const executableChanges = changedFiles.filter(
    (file) => !DOCUMENTATION_FILE.test(file),
  );

  if (executableChanges.length === 0) {
    return {
      mode: "none",
      tests: [],
      browser: "none",
      build: false,
      changedFiles,
      reason: "documentation-only change",
    };
  }

  const selectedTests = new Set();
  let mode = "targeted";
  let browser = "none";
  let build = false;
  const reasons = new Set();

  for (const file of executableChanges) {
    if (file.startsWith(testPrefix) && TEST_FILE.test(file)) {
      selectedTests.add(file);
      reasons.add("changed test file");
      continue;
    }

    if (FULL_AND_BUILD_FILES.has(file)) {
      mode = "full";
      build = true;
      browser = combineBrowser(browser, "all");
      reasons.add("cross-cutting build or runtime change");
      continue;
    }

    if (GUESTBOOK_FILE.test(file)) {
      addGroupTests(selectedTests, availableTests, "guestbook");
      if (GUESTBOOK_BROWSER_FILE.test(file)) {
        browser = combineBrowser(browser, "guestbook");
      }
      reasons.add("guestbook change");
      continue;
    }

    if (NAVIGATION_FILE.test(file)) {
      addGroupTests(selectedTests, availableTests, "navigation");
      if (NAVIGATION_BROWSER_FILE.test(file)) {
        browser = combineBrowser(browser, "navigation");
      }
      reasons.add("navigation change");
      continue;
    }

    if (MIGRATION_FILE.test(file)) {
      addGroupTests(selectedTests, availableTests, "migrations");
      reasons.add("migration or persistence change");
      continue;
    }

    if (file.startsWith(`${packagePrefix}src/client/`)) {
      mode = "full";
      browser = combineBrowser(browser, "all");
      reasons.add("unmapped client change");
      continue;
    }

    if (
      file.startsWith(`${packagePrefix}src/`) ||
      file.startsWith(`${packagePrefix}scripts/`) ||
      file.startsWith(".github/workflows/")
    ) {
      mode = "full";
      reasons.add("unmapped executable change");
      continue;
    }

    mode = "full";
    reasons.add("unknown relevant change");
  }

  if (mode === "targeted" && selectedTests.size === 0) {
    mode = "full";
    reasons.add("no targeted tests matched; safe fallback");
  }

  return {
    mode,
    tests: mode === "targeted" ? [...selectedTests].sort() : [],
    browser,
    build,
    changedFiles,
    reason: [...reasons].sort().join("; "),
  };
}

export function changedFilesFromGit(base, head = "HEAD") {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `${base}...${head}`],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return normalizeFiles(output.split(/\r?\n/u));
}

function printGitHubOutputs(selection) {
  console.log(`mode=${selection.mode}`);
  console.log(`tests=${JSON.stringify(selection.tests)}`);
  console.log(`browser=${selection.browser}`);
  console.log(`build=${selection.build ? "true" : "false"}`);
  console.log(`changed_count=${selection.changedFiles.length}`);
  console.log(`reason=${selection.reason}`);
}

function runCli() {
  const args = process.argv.slice(2);
  let files;

  if (args[0] === "--files") {
    files = args.slice(1);
  } else {
    const base = args[0] ?? "HEAD~1";
    const head = args[1] ?? "HEAD";
    files = changedFilesFromGit(base, head);
  }

  const selection = selectTestsForFiles(files);
  printGitHubOutputs(selection);
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli();
}
