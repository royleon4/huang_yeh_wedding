import { useEffect, useMemo, useRef } from "react";
import { renderWordDocumentFromUrl } from "./word-fidelity.mjs";
import "./rich-text-formatting.css";
import "./word-document.css";

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
  "process-attachment-card",
  "process-attachment-icon",
  "process-attachment-name",
  "process-attachment-meta",
  "process-align-left",
  "process-align-center",
  "process-align-right",
  "process-align-justify",
  "process-word-document",
  "process-word-document-preview",
  "process-word-document-fallback",
]);
const SAFE_TEXT_ALIGNMENTS = new Set(["left", "center", "right", "justify"]);

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

function safeMediaWidth(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(24, Math.min(100, Math.round(parsed)));
}

function safeTextAlignment(styleValue) {
  const match = String(styleValue ?? "").match(/(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i);
  const alignment = match?.[1]?.toLowerCase() ?? "";
  return SAFE_TEXT_ALIGNMENTS.has(alignment) ? alignment : "";
}

function safeMetadata(value, maxLength = 180) {
  return String(value || "").normalize("NFKC").trim().slice(0, maxLength);
}

export function hasRichContent(value) {
  const html = String(value ?? "").trim();
  if (!html) return false;
  if (/<(img|a)\b/i.test(html) || /data-type=["']word-document["']/i.test(html)) {
    return true;
  }
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
      const attributeValue = (name) =>
        attributes.find((item) => item.name === name)?.value ?? "";
      const originalClassName = String(attributeValue("class"));
      const originalStyle = attributeValue("style");
      const originalWidth = attributeValue("data-width");
      for (const attribute of attributes) child.removeAttribute(attribute.name);

      if (child.tagName === "A") {
        const href = safeUrl(attributeValue("href"));
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
        const src = safeUrl(attributeValue("src"), { image: true });
        if (!src) {
          child.remove();
          continue;
        }
        child.setAttribute("src", src);
        child.setAttribute("alt", safeMetadata(attributeValue("alt"), 240));
        child.setAttribute("loading", "lazy");
        child.setAttribute("decoding", "async");
      }

      const classNames = originalClassName
        .split(/\s+/)
        .filter((name) => SAFE_CLASSES.has(name));
      if (classNames.length) child.setAttribute("class", classNames.join(" "));

      const textAlignment = safeTextAlignment(originalStyle);
      if (textAlignment && ["P", "H2", "H3", "LI", "BLOCKQUOTE", "DIV"].includes(child.tagName)) {
        child.style.textAlign = textAlignment;
      }

      const isSizedMedia =
        (child.tagName === "FIGURE" && classNames.includes("process-inline-image")) ||
        (child.tagName === "DIV" && classNames.includes("process-attachment-card"));
      if (isSizedMedia) {
        const width = safeMediaWidth(originalWidth || originalStyle.match(/width\s*:\s*([\d.]+)%/i)?.[1]);
        child.setAttribute("data-width", String(width));
        child.style.width = `${width}%`;
      }

      const isWordDocument =
        child.tagName === "DIV" && classNames.includes("process-word-document");
      if (isWordDocument) {
        const source = safeUrl(attributeValue("data-src"));
        const downloadUrl = safeUrl(attributeValue("data-download-url")) || source;
        if (!source) {
          child.remove();
          continue;
        }
        child.setAttribute("data-type", "word-document");
        child.setAttribute("data-src", source);
        child.setAttribute("data-download-url", downloadUrl);
        child.setAttribute("data-attachment-id", safeMetadata(attributeValue("data-attachment-id"), 120));
        child.setAttribute("data-name", safeMetadata(attributeValue("data-name")) || "Word 文件");
        child.setAttribute(
          "data-fidelity-reasons",
          safeMetadata(attributeValue("data-fidelity-reasons"), 360),
        );
      }

      if (
        child.tagName === "DIV" &&
        classNames.includes("process-word-document-preview")
      ) {
        child.setAttribute("aria-label", safeMetadata(attributeValue("aria-label"), 240));
      }

      clean(child);
    }
  };
  clean(root);
  return root.innerHTML;
}

function useWordDocumentPreviews(rootRef, sanitized) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const controllers = [];
    for (const documentElement of root.querySelectorAll(
      ".process-word-document[data-type='word-document']",
    )) {
      const preview = documentElement.querySelector(".process-word-document-preview");
      const source = documentElement.getAttribute("data-src");
      if (!preview || !source) continue;
      const controller = new AbortController();
      controllers.push(controller);
      documentElement.dataset.wordRenderState = "loading";
      void renderWordDocumentFromUrl(
        source,
        preview,
        preview,
        controller.signal,
      )
        .then(() => {
          documentElement.dataset.wordRenderState = "ready";
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            documentElement.dataset.wordRenderState = "error";
          }
        });
    }
    return () => controllers.forEach((controller) => controller.abort());
  }, [rootRef, sanitized]);
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
  const rootRef = useRef(null);
  const sanitized = useMemo(() => sanitizeRichContent(html), [html]);
  useWordDocumentPreviews(rootRef, sanitized);
  if (!hasRichContent(html) || !hasRichContent(sanitized)) return null;
  return (
    <section
      ref={rootRef}
      className="process-rich-content"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
