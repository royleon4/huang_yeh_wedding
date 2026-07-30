import { spawn } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const env = {
  ...process.env,
  PORT: process.env.PORT || "19315",
  BASE_PATH: process.env.BASE_PATH || "/",
};

const child = spawn(
  pnpmCommand,
  ["-r", "--if-present", "run", "build"],
  {
    cwd: new URL("..", import.meta.url),
    env,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("Unable to start the workspace build", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Workspace build terminated by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
