const WORD_RENDER_OPTIONS = Object.freeze({
  inWrapper: true,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  ignoreLastRenderedPageBreak: false,
  experimental: true,
  trimXmlDeclaration: true,
  useBase64URL: false,
});

let docxPreviewPromise = null;

async function loadDocxPreview() {
  if (!docxPreviewPromise) {
    docxPreviewPromise = import("docx-preview").then((loaded) => {
      const renderAsync = loaded.renderAsync || loaded.default?.renderAsync;
      if (typeof renderAsync !== "function") {
        throw new Error("Word 保真顯示元件無法載入。");
      }
      return { renderAsync };
    });
  }
  return docxPreviewPromise;
}

function count(root, selector) {
  return root.querySelectorAll(selector).length;
}

function hasStyle(root, pattern) {
  return [...root.querySelectorAll("[style]")].some((element) =>
    pattern.test(String(element.getAttribute("style") || "")),
  );
}

export function analyzeRenderedWordDocument(root) {
  const pages = Math.max(1, count(root, "section.docx"));
  const tables = count(root, "table");
  const headers = count(root, "header, .docx-header");
  const footers = count(root, "footer, .docx-footer");
  const footnotes = count(root, ".docx-footnote, .docx-footnotes, [class*='footnote']");
  const endnotes = count(root, ".docx-endnote, .docx-endnotes, [class*='endnote']");
  const drawings = count(root, "svg, canvas, .docx-drawing, [class*='shape']");
  const positioned = hasStyle(root, /(?:^|;)\s*position\s*:\s*(?:absolute|fixed)\b/i);
  const columns = hasStyle(root, /(?:^|;)\s*(?:column-count|columns)\s*:/i);
  const pageBreaks = count(root, ".docx-page-break, [style*='break-before'], [style*='page-break-before']");
  const advancedTypography = hasStyle(
    root,
    /(?:^|;)\s*(?:font-family|font-size|letter-spacing|line-height|text-indent|background(?:-color)?|color|vertical-align)\s*:/i,
  );
  const advancedSpacing = hasStyle(
    root,
    /(?:^|;)\s*(?:margin-(?:top|right|bottom|left)|padding-(?:top|right|bottom|left))\s*:/i,
  );

  const reasons = [];
  if (pages > 1) reasons.push("分頁");
  if (tables > 0) reasons.push("表格");
  if (headers > 0) reasons.push("頁首");
  if (footers > 0) reasons.push("頁尾");
  if (footnotes > 0) reasons.push("註腳");
  if (endnotes > 0) reasons.push("章末註");
  if (drawings > 0) reasons.push("圖形或繪圖物件");
  if (positioned) reasons.push("浮動或定位物件");
  if (columns) reasons.push("多欄排版");
  if (pageBreaks > 0) reasons.push("強制分頁");
  if (advancedTypography) reasons.push("Word 字型或字級樣式");
  if (advancedSpacing) reasons.push("Word 段落間距或縮排");

  return {
    pages,
    tables,
    headers,
    footers,
    footnotes,
    endnotes,
    drawings,
    positioned,
    columns,
    pageBreaks,
    advancedTypography,
    advancedSpacing,
    reasons,
    requiresFidelity: reasons.length > 0,
  };
}

export async function inspectWordFidelity(file) {
  if (typeof document === "undefined") {
    return { requiresFidelity: false, reasons: [], pages: 1 };
  }
  const body = document.createElement("div");
  const styles = document.createElement("div");
  const { renderAsync } = await loadDocxPreview();
  await renderAsync(await file.arrayBuffer(), body, styles, WORD_RENDER_OPTIONS);
  return analyzeRenderedWordDocument(body);
}

export function fidelityReasonText(report) {
  const reasons = Array.isArray(report?.reasons) ? report.reasons : [];
  return reasons.length > 0 ? reasons.join("、") : "一般段落內容";
}

export async function renderWordDocumentBuffer(arrayBuffer, container, styleContainer = container) {
  if (!container) throw new Error("找不到 Word 顯示區域。");
  container.replaceChildren();
  const { renderAsync } = await loadDocxPreview();
  await renderAsync(arrayBuffer, container, styleContainer, WORD_RENDER_OPTIONS);
  container.dataset.wordRenderState = "ready";
}

export async function renderWordDocumentFromUrl(url, container, styleContainer = container, signal) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "force-cache",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Word 文件讀取失敗（${response.status}）`);
  }
  await renderWordDocumentBuffer(await response.arrayBuffer(), container, styleContainer);
}
