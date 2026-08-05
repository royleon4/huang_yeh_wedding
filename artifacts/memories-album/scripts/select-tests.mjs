import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
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
const EXECUTABLE_FILE = /\.(?:c?js|mjs|jsx|json|css|sql|ya?ml)$/i;
const CODE_FILE = /\.(?:c?js|mjs|jsx)$/i;

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
  `${packagePrefix}src/client/main.jsx`,
  `${packagePrefix}src/server/runtime.mjs`,
]);

const BUILD_RELEVANT_FILE =
  /(?:^|\/)(?:vite(?:\.routes)?\.config\.js|.*-ui-transform\.mjs|public-bootstrap-ui-transform\.mjs)$/;
const GUESTBOOK_FILE =
  /(?:^|\/)(?:MessageAlbum\.jsx|MessageModal\.jsx|AdminMessagesPanel\.jsx|message-album\.css|admin-messages\.css|message-album-ui-transform\.mjs|album-photo-order\.mjs|messages\/)/;
const GUESTBOOK_BROWSER_FILE =
  /(?:^|\/)(?:MessageAlbum\.jsx|MessageModal\.jsx|message-album\.css|message-album-ui-transform\.mjs|verify-guestbook-layout\.mjs)$/;
const NAVIGATION_FILE =
  /(?:^|\/)(?:BottomCollectionNav\.jsx|bottom-collection-nav\.css|content-navigation|gallery-navigation|process-wheel|ProcessSelector|ProcessWheel|route-state|stable-identity-routes|verify-navigation-layout\.mjs)/;
const NAVIGATION_BROWSER_FILE =
  /(?:^|\/)(?:BottomCollectionNav\.jsx|bottom-collection-nav\.css|content-navigation|gallery-navigation|process-wheel|ProcessSelector|ProcessWheel|verify-navigation-layout\.mjs)/;
const MIGRATION_FILE = /(?:^|\/)(?:db\/|migrations?|migrate)\b/i;
const GENERIC_VISUAL_FILE =
  /(?:^|\/)(?:.*\.css|.*(?:Layout|Grid|Modal|Card|Strip|Selector|Nav|Viewer|Lightbox)\.jsx)$/;

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

const TOKEN_STOP_WORDS = new Set([
  "admin",
  "album",
  "artifacts",
  "client",
  "component",
  "index",
  "memories",
  "model",
  "module",
  "repository",
  "scripts",
  "server",
  "service",
  "source",
  "test",
  "tests",
]);

function normalizePath(file) {
  return String(file ?? "").trim().replaceAll("\\", "/");
}

function normalizeFiles(files) {
  return [...new Set(files.map(normalizePath).filter(Boolean))].sort();
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

function walkFiles(directory, predicate, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, predicate, files);
    } else if (predicate(absolute)) {
      files.push(absolute);
    }
  }
  return files;
}

function repositoryPath(absolute) {
  return normalizePath(path.relative(repositoryRoot, absolute));
}

function absolutePath(repositoryFile) {
  return path.resolve(repositoryRoot, normalizePath(repositoryFile));
}

export function discoverAvailableTests() {
  return walkFiles(testDirectory, (file) => TEST_FILE.test(file))
    .map(repositoryPath)
    .sort();
}

function moduleSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveRelativeModule(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(absolutePath(importer)), specifier);
  const candidates = [
    base,
    ...[".mjs", ".js", ".jsx", ".cjs", ".json"].map(
      (extension) => `${base}${extension}`,
    ),
    ...[".mjs", ".js", ".jsx", ".cjs"].map((extension) =>
      path.join(base, `index${extension}`),
    ),
  ];
  const resolved = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
  return resolved ? repositoryPath(resolved) : null;
}

function fileStem(file) {
  return path
    .basename(normalizePath(file))
    .replace(/\.test\.mjs$/i, "")
    .replace(/\.(?:c?js|mjs|jsx|json|css|sql|ya?ml)$/i, "");
}

function meaningfulTokens(file) {
  const expanded = fileStem(file).replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return new Set(
    expanded
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 4 && !TOKEN_STOP_WORDS.has(token)),
  );
}

function tokenOverlap(left, right) {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function createImpactIndex(availableTests) {
  const normalizedTests = normalizeFiles(availableTests);
  const testSet = new Set(normalizedTests);
  const packageFiles = walkFiles(packageRoot, (file) => CODE_FILE.test(file)).map(
    repositoryPath,
  );
  const reverseDependencies = new Map();
  const testContents = new Map();

  for (const importer of packageFiles) {
    let source;
    try {
      source = readFileSync(absolutePath(importer), "utf8");
    } catch {
      continue;
    }
    if (testSet.has(importer)) testContents.set(importer, source);
    for (const specifier of moduleSpecifiers(source)) {
      const dependency = resolveRelativeModule(importer, specifier);
      if (!dependency) continue;
      const importers = reverseDependencies.get(dependency) ?? new Set();
      importers.add(importer);
      reverseDependencies.set(dependency, importers);
    }
  }

  for (const testPath of normalizedTests) {
    if (testContents.has(testPath) || !existsSync(absolutePath(testPath))) continue;
    try {
      testContents.set(testPath, readFileSync(absolutePath(testPath), "utf8"));
    } catch {
      // A missing test is ignored here and will still be validated when Node runs it.
    }
  }

  return {
    relatedTests(file) {
      const changed = normalizePath(file);
      const selected = new Set();
      const queue = [changed];
      const visited = new Set(queue);

      while (queue.length > 0) {
        const dependency = queue.shift();
        for (const importer of reverseDependencies.get(dependency) ?? []) {
          if (testSet.has(importer)) selected.add(importer);
          if (!visited.has(importer)) {
            visited.add(importer);
            queue.push(importer);
          }
        }
      }

      const basename = path.basename(changed);
      const relativeToPackage = changed.startsWith(packagePrefix)
        ? changed.slice(packagePrefix.length)
        : changed;
      const changedStem = fileStem(changed).toLowerCase();
      const changedTokens = meaningfulTokens(changed);

      for (const testPath of normalizedTests) {
        const source = testContents.get(testPath) ?? "";
        const testStem = fileStem(testPath).toLowerCase();
        if (
          source.includes(basename) ||
          source.includes(relativeToPackage) ||
          testStem.includes(changedStem) ||
          changedStem.includes(testStem)
        ) {
          selected.add(testPath);
          continue;
        }
        if (tokenOverlap(changedTokens, meaningfulTokens(testPath)) >= 2) {
          selected.add(testPath);
        }
      }

      return [...selected].sort();
    },
  };
}

export function selectTestsForFiles(
  files,
  availableTests = discoverAvailableTests(),
) {
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
  const impactIndex = createImpactIndex(availableTests);
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
    }

    if (NAVIGATION_FILE.test(file)) {
      addGroupTests(selectedTests, availableTests, "navigation");
      if (NAVIGATION_BROWSER_FILE.test(file)) {
        browser = combineBrowser(browser, "navigation");
      }
      reasons.add("navigation change");
    }

    if (MIGRATION_FILE.test(file)) {
      addGroupTests(selectedTests, availableTests, "migrations");
      reasons.add("migration or persistence change");
    }

    const relatedTests = impactIndex.relatedTests(file);
    for (const testPath of relatedTests) selectedTests.add(testPath);
    if (relatedTests.length > 0) reasons.add("dependency-related tests");

    if (BUILD_RELEVANT_FILE.test(file)) {
      build = true;
      reasons.add("production transform or build surface");
    }

    if (
      browser === "none" &&
      file.startsWith(`${packagePrefix}src/client/`) &&
      GENERIC_VISUAL_FILE.test(file)
    ) {
      browser = "all";
      reasons.add("visual client surface");
    }

    const isRelevantExecutable =
      EXECUTABLE_FILE.test(file) &&
      (file.startsWith(packagePrefix) || file.startsWith(".github/workflows/"));
    if (isRelevantExecutable && relatedTests.length === 0) {
      const matchedExplicitGroup =
        GUESTBOOK_FILE.test(file) ||
        NAVIGATION_FILE.test(file) ||
        MIGRATION_FILE.test(file);
      if (!matchedExplicitGroup) {
        mode = "full";
        reasons.add("no related test could be proven; safe fallback");
      }
    }

    if (!isRelevantExecutable && !file.startsWith("docs/")) {
      mode = "full";
      reasons.add("unknown relevant change");
    }
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

  printGitHubOutputs(selectTestsForFiles(files));
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) runCli();
