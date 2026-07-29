console.error(
  [
    "Refusing to run drizzle-kit push for this workspace.",
    "The shared Drizzle schema is intentionally empty and is not the source of truth for Memories.",
    "Run: pnpm --filter @workspace/memories-album run db:migrate",
  ].join("\n"),
);
process.exitCode = 1;
