import { execFileSync } from "node:child_process";

const [baseRef = "origin/main", headRef = "HEAD"] = process.argv.slice(2);
const protectedPaths = [
  "artifacts/wedding-invitation/",
  "artifacts/api-server/src/routes/photos.ts",
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let changedFiles;
try {
  const output = git(["diff", "--name-only", `${baseRef}...${headRef}`]);
  changedFiles = output ? output.split("\n").filter(Boolean) : [];
} catch (error) {
  console.error(`Unable to compare ${baseRef}...${headRef}`);
  throw error;
}

const violations = changedFiles.filter((file) =>
  protectedPaths.some((protectedPath) =>
    protectedPath.endsWith("/")
      ? file.startsWith(protectedPath)
      : file === protectedPath,
  ),
);

if (violations.length > 0) {
  console.error("Memories work modified protected legacy wedding paths:");
  for (const file of violations) console.error(`- ${file}`);
  console.error(
    "Remove these changes or obtain explicit owner approval and apply the owner-approved-legacy-change PR label.",
  );
  process.exit(1);
}

console.log("Legacy wedding boundary check passed.");
