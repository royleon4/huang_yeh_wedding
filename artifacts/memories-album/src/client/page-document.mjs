const PDF_MIME_TYPE = "application/pdf";
const PPT_MIME_TYPE = "application/vnd.ms-powerpoint";
const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

let pdfJsPromise = null;
let pdfWorkerUrlPromise = null;
let pptxRendererPromise = null;
let pptxPdfAssetsPromise = null;

function normalizedName(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function normalizedMimeType(value) {
  return String(value || "").trim().toLowerCase();
}

export function pageDocumentKind({ name = "", mimeType = "" } = {}) {
  const fileName = normalizedName(name);
  const type = normalizedMimeType(mimeType);
  if (type === PDF_MIME_TYPE || fileName.endsWith(".pdf")) return "pdf";
  if (type === PPTX_MIME_TYPE || fileName.endsWith(".pptx")) return "pptx";
  if (type === PPT_MIME_TYPE || fileName.endsWith(".ppt")) return "ppt";
  return "";
}

export function isPageDocumentAttachment(attachment) {
  return Boolean(pageDocumentKind(attachment));
}

export function pageDocumentLabel(kind) {
  if (kind === "pdf") return "PDF 文件";
  if (kind === "pptx") return "PowerPoint 簡報";
  if (kind === "ppt") return "舊式 PowerPoint 簡報";
  return "文件";
}

async function fetchArrayBuffer(url, signal) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "force-cache",
    signal,
  });
  if (!response.ok) {
    throw new Error(`文件讀取失敗（${response.status}）`);
  }
  return response.arrayBuffer();
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/build/pdf.mjs");
  }
  return pdfJsPromise;
}

async function loadPdfWorkerUrl() {
  if (!pdfWorkerUrlPromise) {
    pdfWorkerUrlPromise = import("pdfjs-dist/build/pdf.worker.min.mjs?url").then(
      (loaded) => loaded.default,
    );
  }
  return pdfWorkerUrlPromise;
}

async function loadPptxRenderer() {
  if (!pptxRendererPromise) {
    pptxRendererPromise = import("@aiden0z/pptx-renderer");
  }
  return pptxRendererPromise;
}

async function loadPptxPdfAssets() {
  if (!pptxPdfAssetsPromise) {
    pptxPdfAssetsPromise = Promise.all([
      import("pdfjs-dist/build/pdf.min.mjs?url").then((loaded) => loaded.default),
      loadPdfWorkerUrl(),
    ]).then(([moduleUrl, workerUrl]) => ({ moduleUrl, workerUrl }));
  }
  return pptxPdfAssetsPromise;
}

function createAccessiblePageText(textContent, pageNumber) {
  const paragraph = document.createElement("p");
  paragraph.className = "sr-only process-page-document-text";
  paragraph.setAttribute("data-page-number", String(pageNumber));
  paragraph.textContent = (textContent?.items || [])
    .map((item) => String(item?.str || "").trim())
    .filter(Boolean)
    .join(" ");
  return paragraph;
}

async function renderPdfDocument(arrayBuffer, container, signal) {
  const pdfjs = await loadPdfJs();
  pdfjs.GlobalWorkerOptions.workerSrc = await loadPdfWorkerUrl();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  signal?.addEventListener("abort", () => loadingTask.destroy(), { once: true });
  const pdf = await loadingTask.promise;
  const renderedPages = new Set();
  const renderingPages = new Map();
  const pageSections = [];

  const renderPage = async (pageNumber) => {
    if (signal?.aborted || renderedPages.has(pageNumber)) return;
    if (renderingPages.has(pageNumber)) return renderingPages.get(pageNumber);
    const task = (async () => {
      const section = pageSections[pageNumber - 1];
      if (!section) return;
      const page = await pdf.getPage(pageNumber);
      if (signal?.aborted) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, container.clientWidth - 32);
      const cssScale = Math.min(1.6, availableWidth / baseViewport.width);
      const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const viewport = page.getViewport({ scale: cssScale * pixelRatio });
      const canvas = document.createElement("canvas");
      canvas.className = "process-page-document-pdf-canvas";
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;
      canvas.setAttribute("aria-label", `PDF 第 ${pageNumber} 頁`);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("瀏覽器無法建立 PDF 畫布。");
      await page.render({ canvasContext: context, viewport }).promise;
      const textContent = await page.getTextContent().catch(() => null);
      section.replaceChildren(canvas);
      if (textContent) section.append(createAccessiblePageText(textContent, pageNumber));
      section.dataset.renderState = "ready";
      renderedPages.add(pageNumber);
      page.cleanup();
    })().finally(() => renderingPages.delete(pageNumber));
    renderingPages.set(pageNumber, task);
    return task;
  };

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const section = document.createElement("section");
    section.className = "process-page-document-page process-page-document-pdf-page";
    section.dataset.pageNumber = String(pageNumber);
    section.dataset.renderState = "waiting";
    section.setAttribute("aria-label", `PDF 第 ${pageNumber} 頁`);
    const placeholder = document.createElement("p");
    placeholder.className = "process-page-document-page-placeholder";
    placeholder.textContent = `正在準備第 ${pageNumber} 頁…`;
    section.append(placeholder);
    container.append(section);
    pageSections.push(section);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const pageNumber = Number(entry.target.dataset.pageNumber);
        if (!Number.isInteger(pageNumber)) continue;
        observer.unobserve(entry.target);
        void renderPage(pageNumber);
      }
    },
    {
      root: container,
      rootMargin: "120% 0px",
      threshold: 0.01,
    },
  );
  pageSections.forEach((section) => observer.observe(section));
  await Promise.all([renderPage(1), pdf.numPages > 1 ? renderPage(2) : null]);

  return {
    count: pdf.numPages,
    destroy() {
      observer.disconnect();
      loadingTask.destroy();
      pdf.destroy();
    },
  };
}

async function renderPptxDocument(arrayBuffer, container, signal) {
  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await loadPptxRenderer();
  const pdfjs = await loadPptxPdfAssets();
  const viewer = await PptxViewer.open(arrayBuffer, container, {
    renderMode: "list",
    fitMode: "contain",
    zipLimits: RECOMMENDED_ZIP_LIMITS,
    listOptions: {
      windowed: true,
      batchSize: 6,
      initialSlides: 2,
      overscanViewport: 1.25,
    },
    pdfjs,
    signal,
  });
  return {
    count: viewer.slideCount,
    destroy() {
      viewer.destroy();
    },
  };
}

function renderLegacyPptDocument(url, container) {
  const absoluteSource = new URL(url, window.location.origin);
  const iframe = document.createElement("iframe");
  iframe.className = "process-page-document-office-frame";
  iframe.title = "舊式 PowerPoint 簡報預覽";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    absoluteSource.href,
  )}`;
  container.append(iframe);
  return {
    count: null,
    destroy() {
      iframe.src = "about:blank";
      iframe.remove();
    },
  };
}

export async function renderPageDocumentFromUrl({ kind, url, container, signal }) {
  if (!container) throw new Error("找不到文件顯示區域。");
  if (!url) throw new Error("找不到文件來源。");
  container.replaceChildren();
  container.dataset.documentKind = kind;
  if (kind === "ppt") return renderLegacyPptDocument(url, container);
  const arrayBuffer = await fetchArrayBuffer(url, signal);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (kind === "pdf") return renderPdfDocument(arrayBuffer, container, signal);
  if (kind === "pptx") return renderPptxDocument(arrayBuffer, container, signal);
  throw new Error("這個文件格式不支援頁面保真顯示。");
}
