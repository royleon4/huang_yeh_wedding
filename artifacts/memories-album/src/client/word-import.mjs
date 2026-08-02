export const WORD_IMPORT_ACCEPT = [
  ".docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

export const WORD_IMPORT_MAX_BYTES = 25 * 1024 * 1024;
export const WORD_IMPORT_MAX_HTML_CHARACTERS = 190_000;

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SUPPORTED_IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const ALLOWED_TAGS = new Set([
  "P",
  "H2",
  "H3",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "STRONG",
  "EM",
  "U",
  "S",
  "A",
  "BR",
  "IMG",
]);

function normalizedFilename(file) {
  return String(file?.name || "Word 文件").normalize("NFKC").trim();
}

export function validateWordImportFile(file) {
  if (!file) throw new Error("請選擇要匯入的 Word 文件。");
  const name = normalizedFilename(file);
  const type = String(file.type || "").toLowerCase();
  const isDocx = name.toLowerCase().endsWith(".docx") || type === DOCX_MIME_TYPE;
  if (!isDocx) {
    throw new Error("目前支援 .docx；舊式 .doc 請先在 Word 另存為 .docx。");
  }
  const size = Number(file.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Word 文件是空的或無法讀取。");
  }
  if (size > WORD_IMPORT_MAX_BYTES) {
    throw new Error("Word 文件超過 25 MB，請先縮小圖片或拆分文件。");
  }
  return { name, size, type: type || DOCX_MIME_TYPE };
}

export function isSupportedWordImageType(mimeType) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(String(mimeType || "").toLowerCase());
}

export function wordImageFilename(index, mimeType) {
  const extension =
    SUPPORTED_IMAGE_EXTENSIONS.get(String(mimeType || "").toLowerCase()) || "bin";
  return `word-image-${String(index).padStart(2, "0")}.${extension}`;
}

function safeImportedUrl(raw, { image = false } = {}) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (!/^https?:$/.test(url.protocol)) return "";
    if (image && value.startsWith("/") && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    return "";
  }
}

function replaceTag(element, tagName) {
  const replacement = element.ownerDocument.createElement(tagName);
  while (element.firstChild) replacement.append(element.firstChild);
  element.replaceWith(replacement);
  return replacement;
}

function flattenTable(table) {
  const documentNode = table.ownerDocument;
  const fragment = documentNode.createDocumentFragment();
  for (const row of table.querySelectorAll("tr")) {
    const paragraph = documentNode.createElement("p");
    const cells = [...row.querySelectorAll(":scope > th, :scope > td")];
    cells.forEach((cell, index) => {
      if (index > 0) paragraph.append(documentNode.createTextNode(" ｜ "));
      while (cell.firstChild) paragraph.append(cell.firstChild);
    });
    if (paragraph.textContent?.trim() || paragraph.querySelector("img")) {
      fragment.append(paragraph);
    }
  }
  table.replaceWith(fragment);
}

function unwrap(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}

export function sanitizeImportedWordHtml(value) {
  if (typeof DOMParser === "undefined") {
    throw new Error("此瀏覽器無法解析 Word 文件。");
  }
  const documentNode = new DOMParser().parseFromString(
    `<div>${String(value || "")}</div>`,
    "text/html",
  );
  const root = documentNode.body.firstElementChild;
  if (!root) return "";

  for (const table of [...root.querySelectorAll("table")]) flattenTable(table);

  for (const element of [...root.querySelectorAll("*")]) {
    let current = element;
    const tagName = current.tagName;
    if (tagName === "H1") current = replaceTag(current, "h2");
    else if (["H4", "H5", "H6"].includes(tagName)) current = replaceTag(current, "h3");
    else if (tagName === "B") current = replaceTag(current, "strong");
    else if (tagName === "I") current = replaceTag(current, "em");
    else if (["STRIKE", "DEL"].includes(tagName)) current = replaceTag(current, "s");

    if (!ALLOWED_TAGS.has(current.tagName)) {
      unwrap(current);
      continue;
    }

    const attributes = [...current.attributes];
    for (const attribute of attributes) current.removeAttribute(attribute.name);

    if (current.tagName === "A") {
      const original = element.getAttribute("href");
      const href = safeImportedUrl(original);
      if (!href) {
        unwrap(current);
        continue;
      }
      current.setAttribute("href", href);
      current.setAttribute("target", "_blank");
      current.setAttribute("rel", "noopener noreferrer");
    }

    if (current.tagName === "IMG") {
      const src = safeImportedUrl(element.getAttribute("src"), { image: true });
      if (!src) {
        current.remove();
        continue;
      }
      current.setAttribute("src", src);
      const alt = String(element.getAttribute("alt") || "").trim().slice(0, 160);
      if (alt) current.setAttribute("alt", alt);
    }
  }

  return root.innerHTML.trim();
}

function mammothWarnings(messages) {
  return (Array.isArray(messages) ? messages : []).filter(
    (message) => message?.type === "warning" || message?.type === "error",
  ).length;
}

export async function convertWordFileToHtml(file, { uploadImage } = {}) {
  const metadata = validateWordImportFile(file);
  const loaded = await import("mammoth");
  const mammoth = loaded.default || loaded;
  let imageIndex = 0;
  let importedImages = 0;
  let skippedImages = 0;

  const convertImage = mammoth.images.imgElement(async (image) => {
    imageIndex += 1;
    const mimeType = String(image.contentType || "").toLowerCase();
    if (!uploadImage || !isSupportedWordImageType(mimeType)) {
      skippedImages += 1;
      return { src: "" };
    }
    try {
      const bytes = await image.readAsArrayBuffer();
      const imageFile = new File([bytes], wordImageFilename(imageIndex, mimeType), {
        type: mimeType,
      });
      const attachment = await uploadImage(imageFile);
      const src = attachment?.url || attachment?.downloadUrl || "";
      if (!src) throw new Error("圖片上傳沒有回傳網址");
      importedImages += 1;
      return { src, alt: imageFile.name };
    } catch {
      skippedImages += 1;
      return { src: "" };
    }
  });

  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      externalFileAccess: false,
      ignoreEmptyParagraphs: false,
      convertImage,
      styleMap: [
        "p[style-name='Title'] => h2:fresh",
        "p[style-name='Subtitle'] => h3:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "u => u",
      ],
    },
  );
  const html = sanitizeImportedWordHtml(result.value);
  const plainText = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  if (!plainText && !/<img\b/i.test(html)) {
    throw new Error("這份 Word 文件沒有可匯入的文字或支援的圖片。");
  }
  if (Array.from(html).length > WORD_IMPORT_MAX_HTML_CHARACTERS) {
    throw new Error("轉換後的內容過長，請拆分 Word 文件後再匯入。");
  }

  return {
    fileName: metadata.name,
    html,
    importedImages,
    skippedImages,
    warningCount: mammothWarnings(result.messages),
  };
}

export function describeWordImport(result) {
  const details = [];
  if (result.importedImages > 0) details.push(`${result.importedImages} 張圖片已上傳`);
  if (result.skippedImages > 0) details.push(`${result.skippedImages} 張圖片未匯入`);
  if (result.warningCount > 0) details.push(`${result.warningCount} 項格式提示`);
  const suffix = details.length > 0 ? `（${details.join("、")}）` : "";
  return `已從「${result.fileName}」匯入游標位置${suffix}。`;
}
