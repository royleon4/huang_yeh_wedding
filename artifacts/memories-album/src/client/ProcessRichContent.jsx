const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "H2",
  "H3",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "A",
  "IMG",
  "FIGURE",
  "FIGCAPTION",
  "SPAN",
  "DIV",
]);
const SAFE_CLASSES = new Set([
  "process-inline-image",
  "process-attachment-line",
]);

function safeUrl(value, { image = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.origin);
    if (image && url.protocol === "data:" && /^data:image\/(png|jpeg|gif|webp);/i.test(raw)) {
      return raw;
    }
    if (!/^https?:$/.test(url.protocol)) return "";
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : url.href;
  } catch {
    return "";
  }
}

export function hasRichContent(value) {
  const html = String(value ?? "").trim();
  if (!html) return false;
  if (/<(img|a)\b/i.test(html)) return true;
  return html
    .replace(/<br\s*\/?\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

export function sanitizeRichContent(value) {
  const html = String(value ?? "").trim();
  if (!html || typeof DOMParser === "undefined") return "";
  const documentNode = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = documentNode.body.firstElementChild;
  if (!root) return "";

  const clean = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (!ALLOWED_TAGS.has(child.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM"].includes(child.tagName)) {
          child.remove();
          continue;
        }
        child.replaceWith(...child.childNodes);
        continue;
      }

      const attributes = [...child.attributes];
      for (const attribute of attributes) child.removeAttribute(attribute.name);
      if (child.tagName === "A") {
        const href = safeUrl(attributes.find((item) => item.name === "href")?.value);
        if (href) {
          child.setAttribute("href", href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
          if (attributes.some((item) => item.name === "download")) {
            child.setAttribute("download", "");
          }
        }
      }
      if (child.tagName === "IMG") {
        const src = safeUrl(attributes.find((item) => item.name === "src")?.value, {
          image: true,
        });
        if (!src) {
          child.remove();
          continue;
        }
        child.setAttribute("src", src);
        child.setAttribute(
          "alt",
          String(attributes.find((item) => item.name === "alt")?.value ?? ""),
        );
        child.setAttribute("loading", "lazy");
        child.setAttribute("decoding", "async");
      }
      const classNames = String(
        attributes.find((item) => item.name === "class")?.value ?? "",
      )
        .split(/\s+/)
        .filter((name) => SAFE_CLASSES.has(name));
      if (classNames.length) child.setAttribute("class", classNames.join(" "));
      clean(child);
    }
  };
  clean(root);
  return root.innerHTML;
}

export function ProcessDivider({ paddingTop = 12, paddingBottom = 12 }) {
  return (
    <div
      className="process-flow-divider"
      aria-hidden="true"
      style={{
        "--divider-padding-top": `${Math.max(0, Math.min(96, Number(paddingTop) || 0))}px`,
        "--divider-padding-bottom": `${Math.max(0, Math.min(96, Number(paddingBottom) || 0))}px`,
      }}
    >
      <span />
    </div>
  );
}

export default function ProcessRichContent({ html }) {
  if (!hasRichContent(html)) return null;
  const sanitized = sanitizeRichContent(html);
  if (!hasRichContent(sanitized)) return null;
  return (
    <section
      className="process-rich-content"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
