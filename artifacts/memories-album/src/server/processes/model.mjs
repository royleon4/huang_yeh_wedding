export const RESERVED_FOLDER_NAMES = new Set([
  "系統縮圖",
  "訪客上傳",
  "00 未分類",
]);

const DEFAULT_PROCESSES = new Map([
  ["進場", { id: "entrance", en: "Entrance" }],
  ["祈禱", { id: "prayer", en: "Prayer" }],
  ["讚美", { id: "praise", en: "Praise" }],
  ["聖經", { id: "scripture", en: "Scripture" }],
  ["勉勵", { id: "message", en: "Message" }],
  ["證婚", { id: "vows", en: "Vows" }],
  ["謝親恩", { id: "parents", en: "Honouring Parents" }],
  ["祝福", { id: "blessing", en: "Blessing" }],
  ["答禮", { id: "response", en: "Response" }],
  ["影片", { id: "video", en: "Film" }],
  ["退場", { id: "recessional", en: "Recessional" }],
  ["分組照相", { id: "group-photo", en: "Group Photos" }],
]);

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
  const normalizedLabel = String(labelZh ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedLabel) throw new Error("Process label is required");
  return `${String(normalizedOrder).padStart(2, "0")} ${normalizedLabel}`;
}

export function slugFromFolderId(folderId) {
  return `drive-${String(folderId).replace(/[^a-zA-Z0-9_-]/g, "").slice(-32)}`;
}

export function identityForDriveProcess(folderId, labelZh) {
  const known = DEFAULT_PROCESSES.get(labelZh);
  return known ?? { id: slugFromFolderId(folderId), en: labelZh };
}
