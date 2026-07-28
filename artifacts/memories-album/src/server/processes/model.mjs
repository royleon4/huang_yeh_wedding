export const RESERVED_FOLDER_NAMES = new Set(["系統縮圖", "訪客上傳", "00 未分類"]);

export function parseManagedProcessFolder(name) {
  const value = String(name ?? "").normalize("NFKC").trim();
  const match = value.match(/^(\d{2})\s+(.+)$/);
  if (!match || RESERVED_FOLDER_NAMES.has(value)) return null;
  const order = Number(match[1]);
  if (!Number.isInteger(order) || order < 1 || order > 99) return null;
  const labelZh = match[2].trim();
  if (!labelZh) return null;
  return {
    order,
    labelZh,
    folderName: `${String(order).padStart(2, "0")} ${labelZh}`,
  };
}

export function formatManagedProcessFolder(order, labelZh) {
  const normalizedOrder = Math.max(1, Math.min(99, Number(order) || 1));
  const normalizedLabel = String(labelZh ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalizedLabel) throw new Error("Process label is required");
  return `${String(normalizedOrder).padStart(2, "0")} ${normalizedLabel}`;
}

export function slugFromFolderId(folderId) {
  return `drive-${String(folderId).replace(/[^a-zA-Z0-9_-]/g, "").slice(-32)}`;
}
