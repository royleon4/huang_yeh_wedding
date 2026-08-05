export function parsePort(rawValue: unknown): number {
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    throw new Error("PORT environment variable is required");
  }
  const normalized = rawValue.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`PORT must be an integer from 1 to 65535; received "${rawValue}"`);
  }
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535; received "${rawValue}"`);
  }
  return port;
}

export function requiredEnvironmentValue(
  name: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}
