import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const packageRequire = createRequire(new URL("../package.json", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const requiredPackages = ["mammoth", "docx-preview"];

function missingPackages() {
  return requiredPackages.filter((packageName) => {
    try {
      packageRequire.resolve(packageName);
      return false;
    } catch {
      return true;
    }
  });
}

const missingBeforeInstall = missingPackages();

if (missingBeforeInstall.length > 0) {
  console.warn(
    `[Memories build] Missing locked dependencies: ${missingBeforeInstall.join(", ")}. ` +
      "Installing the workspace lockfile before Vite starts.",
  );

  const install = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (install.error) {
    console.error(`[Memories build] Unable to start pnpm install: ${install.error.message}`);
    process.exit(1);
  }
  if (install.status !== 0) {
    console.error(`[Memories build] pnpm install exited with status ${install.status}.`);
    process.exit(install.status || 1);
  }
}

const stillMissing = missingPackages();
if (stillMissing.length > 0) {
  console.error(
    `[Memories build] Dependencies are still unavailable after installation: ${stillMissing.join(", ")}.`,
  );
  process.exit(1);
}

console.log("[Memories build] Word import dependencies are available.");
