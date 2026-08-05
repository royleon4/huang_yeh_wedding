export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  const normalizedPath = String(path ?? "").trim();
  const withLeadingSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
  const pathParts = withLeadingSlash.split("/");
  const bucketName = pathParts[1]?.trim() ?? "";
  const objectName = pathParts.slice(2).join("/");
  if (
    !bucketName ||
    !objectName ||
    objectName.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Object path must contain a bucket and a non-empty object name");
  }

  return { bucketName, objectName };
}
