import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  pageDocumentKind,
  pageDocumentLabel,
  renderPageDocumentFromUrl,
} from "./page-document.mjs";

function safeText(value, fallback = "文件", maxLength = 180) {
  return (
    String(value || "")
      .normalize("NFKC")
      .trim()
      .slice(0, maxLength) || fallback
  );
}

function readPageDocumentAttributes(element) {
  const anchor = element.querySelector("a");
  const name = safeText(element.getAttribute("data-name") || anchor?.textContent);
  const mimeType = safeText(element.getAttribute("data-mime-type"), "", 160);
  const kind =
    element.getAttribute("data-document-kind") || pageDocumentKind({ name, mimeType });
  return {
    attachmentId: element.getAttribute("data-attachment-id") || "",
    name,
    src: element.getAttribute("data-src") || anchor?.getAttribute("href") || "",
    downloadUrl:
      element.getAttribute("data-download-url") || anchor?.getAttribute("href") || "",
    mimeType,
    kind,
  };
}

function PageDocumentView({ node, selected, deleteNode }) {
  const previewRef = useRef(null);
  const cleanupRef = useRef(null);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("正在準備文件內容…");
  const sourceUrl = node.attrs.src || node.attrs.downloadUrl;
  const kind = node.attrs.kind || pageDocumentKind(node.attrs);
  const label = pageDocumentLabel(kind);

  useEffect(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    const preview = previewRef.current;
    if (!preview || !sourceUrl || !kind) {
      setState("error");
      setMessage("找不到可顯示的文件來源。");
      return undefined;
    }
    const controller = new AbortController();
    let disposed = false;
    setState("loading");
    setMessage(`正在還原${label}內容…`);
    void renderPageDocumentFromUrl({
      kind,
      url: sourceUrl,
      container: preview,
      signal: controller.signal,
    })
      .then((renderer) => {
        if (disposed) {
          renderer.destroy?.();
          return;
        }
        cleanupRef.current = () => renderer.destroy?.();
        setState("ready");
        const countText = Number.isInteger(renderer.count)
          ? `，共 ${renderer.count} ${kind === "pdf" ? "頁" : "張投影片"}`
          : "";
        setMessage(`${label}已按原頁面配置顯示${countText}。`);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState("error");
        setMessage(error?.message || `${label}預覽失敗，請開啟原始檔案。`);
      });
    return () => {
      disposed = true;
      controller.abort();
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [kind, label, sourceUrl]);

  return (
    <NodeViewWrapper
      className={`process-page-document tiptap-page-document-node ${selected ? "is-selected" : ""}`}
      data-type="page-document"
      data-document-kind={kind}
      data-render-state={state}
      contentEditable={false}
    >
      <div className="process-page-document-toolbar">
        <div>
          <strong>{safeText(node.attrs.name)}</strong>
          <small>{label}</small>
        </div>
        <div>
          <a
            href={node.attrs.downloadUrl || node.attrs.src}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            開啟原檔
          </a>
          <button type="button" className="danger" onClick={deleteNode}>
            從文章移除
          </button>
        </div>
      </div>
      <p className="process-page-document-status" role="status">
        {message}
      </p>
      <div
        ref={previewRef}
        className="process-page-document-preview"
        aria-label={`${safeText(node.attrs.name)} ${label}保真預覽`}
      />
    </NodeViewWrapper>
  );
}

export const PageDocument = Node.create({
  name: "pageDocument",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      attachmentId: { default: "" },
      name: { default: "文件" },
      src: { default: "" },
      downloadUrl: { default: "" },
      mimeType: { default: "" },
      kind: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='page-document']",
        getAttrs: readPageDocumentAttributes,
      },
      {
        tag: "div.process-page-document",
        getAttrs: readPageDocumentAttributes,
      },
    ];
  },

  renderHTML({ node }) {
    const name = safeText(node.attrs.name);
    const href = node.attrs.downloadUrl || node.attrs.src || "#";
    const kind = node.attrs.kind || pageDocumentKind(node.attrs);
    const label = pageDocumentLabel(kind);
    return [
      "div",
      mergeAttributes({
        class: "process-page-document",
        "data-type": "page-document",
        "data-document-kind": kind,
        "data-attachment-id": node.attrs.attachmentId || "",
        "data-name": name,
        "data-src": node.attrs.src || href,
        "data-download-url": node.attrs.downloadUrl || href,
        "data-mime-type": node.attrs.mimeType || "",
      }),
      [
        "div",
        {
          class: "process-page-document-preview",
          "aria-label": `${name} ${label}保真預覽`,
        },
      ],
      [
        "p",
        { class: "process-page-document-fallback" },
        [
          "a",
          {
            href,
            target: "_blank",
            rel: "noopener noreferrer",
            download: "",
          },
          `開啟原始文件：${name}`,
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageDocumentView);
  },
});
