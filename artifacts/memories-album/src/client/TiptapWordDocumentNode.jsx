import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { renderWordDocumentFromUrl } from "./word-fidelity.mjs";

function safeName(value) {
  return String(value || "Word 文件").normalize("NFKC").trim().slice(0, 160) || "Word 文件";
}

function readWordDocumentAttributes(element) {
  const anchor = element.querySelector("a");
  return {
    attachmentId: element.getAttribute("data-attachment-id") || "",
    name: safeName(element.getAttribute("data-name") || anchor?.textContent),
    src: element.getAttribute("data-src") || anchor?.getAttribute("href") || "",
    downloadUrl:
      element.getAttribute("data-download-url") || anchor?.getAttribute("href") || "",
    reasons: element.getAttribute("data-fidelity-reasons") || "",
  };
}

function WordDocumentView({ node, selected, deleteNode }) {
  const previewRef = useRef(null);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("正在還原 Word 排版…");
  const sourceUrl = node.attrs.src || node.attrs.downloadUrl;

  useEffect(() => {
    if (!previewRef.current || !sourceUrl) {
      setState("error");
      setMessage("找不到 Word 原始文件。");
      return undefined;
    }
    const controller = new AbortController();
    setState("loading");
    setMessage("正在還原 Word 排版…");
    void renderWordDocumentFromUrl(
      sourceUrl,
      previewRef.current,
      previewRef.current,
      controller.signal,
    )
      .then(() => {
        setState("ready");
        setMessage("Word 排版已還原；此區塊會維持文件原始頁面配置。");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState("error");
        setMessage(error?.message || "Word 排版預覽失敗，請開啟原始文件確認。");
      });
    return () => controller.abort();
  }, [sourceUrl]);

  return (
    <NodeViewWrapper
      className={`process-word-document tiptap-word-document-node ${selected ? "is-selected" : ""}`}
      data-type="word-document"
      data-word-render-state={state}
      contentEditable={false}
    >
      <div className="process-word-document-toolbar">
        <div>
          <strong>{safeName(node.attrs.name)}</strong>
          <small>{node.attrs.reasons || "條件式保真模式"}</small>
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
      <p className="process-word-document-status" role="status">{message}</p>
      <div
        ref={previewRef}
        className="process-word-document-preview"
        aria-label={`${safeName(node.attrs.name)} Word 文件保真預覽`}
      />
    </NodeViewWrapper>
  );
}

export const WordDocument = Node.create({
  name: "wordDocument",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      attachmentId: { default: "" },
      name: { default: "Word 文件" },
      src: { default: "" },
      downloadUrl: { default: "" },
      reasons: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='word-document']",
        getAttrs: readWordDocumentAttributes,
      },
      {
        tag: "div.process-word-document",
        getAttrs: readWordDocumentAttributes,
      },
    ];
  },

  renderHTML({ node }) {
    const name = safeName(node.attrs.name);
    const href = node.attrs.downloadUrl || node.attrs.src || "#";
    return [
      "div",
      mergeAttributes({
        class: "process-word-document",
        "data-type": "word-document",
        "data-attachment-id": node.attrs.attachmentId || "",
        "data-name": name,
        "data-src": node.attrs.src || href,
        "data-download-url": node.attrs.downloadUrl || href,
        "data-fidelity-reasons": node.attrs.reasons || "",
      }),
      [
        "div",
        {
          class: "process-word-document-preview",
          "aria-label": `${name} Word 文件保真預覽`,
        },
      ],
      [
        "p",
        { class: "process-word-document-fallback" },
        [
          "a",
          {
            href,
            target: "_blank",
            rel: "noopener noreferrer",
            download: "",
          },
          `開啟 Word 原始文件：${name}`,
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WordDocumentView);
  },
});
