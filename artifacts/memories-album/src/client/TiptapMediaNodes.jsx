import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

export const MIN_MEDIA_WIDTH = 24;
export const MAX_MEDIA_WIDTH = 100;

export function clampMediaWidth(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(parsed)) return MAX_MEDIA_WIDTH;
  return Math.max(MIN_MEDIA_WIDTH, Math.min(MAX_MEDIA_WIDTH, Math.round(parsed)));
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readImageAttributes(element) {
  const image = element.tagName === "IMG" ? element : element.querySelector("img");
  const caption = element.querySelector?.("figcaption")?.textContent?.trim() ?? "";
  return {
    src: image?.getAttribute("src") ?? "",
    alt: image?.getAttribute("alt") ?? "",
    caption,
    width: clampMediaWidth(element.getAttribute?.("data-width") || element.style?.width || 100),
  };
}

function readAttachmentAttributes(element) {
  const anchor = element.querySelector("a");
  const rawName = anchor?.textContent?.trim().replace(/^📎\s*/, "") ?? "附件";
  return {
    attachmentId: element.getAttribute("data-attachment-id") ?? "",
    name: element.getAttribute("data-name") || rawName,
    href: anchor?.getAttribute("href") ?? "",
    downloadUrl: anchor?.getAttribute("href") ?? "",
    mimeType: element.getAttribute("data-mime-type") ?? "",
    byteSize: Number(element.getAttribute("data-byte-size") ?? 0),
    width: clampMediaWidth(element.getAttribute("data-width") || element.style?.width || 100),
  };
}

function moveNode(editor, getPos, direction) {
  const position = typeof getPos === "function" ? getPos() : undefined;
  if (!Number.isInteger(position)) return;
  const current = editor.state.doc.nodeAt(position);
  if (!current) return;

  const transaction = editor.state.tr;
  if (direction < 0) {
    const previous = editor.state.doc.resolve(position).nodeBefore;
    if (!previous) return;
    const target = position - previous.nodeSize;
    transaction.delete(position, position + current.nodeSize);
    transaction.insert(target, current);
  } else {
    const nextPosition = position + current.nodeSize;
    const next = editor.state.doc.nodeAt(nextPosition);
    if (!next) return;
    transaction.delete(position, position + current.nodeSize);
    transaction.insert(position + next.nodeSize, current);
  }
  editor.view.dispatch(transaction.scrollIntoView());
}

function MediaNodeShell({
  children,
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
  deleteNode,
  className,
  as = "div",
}) {
  const rootRef = useRef(null);
  const [draftWidth, setDraftWidth] = useState(() => clampMediaWidth(node.attrs.width));

  useEffect(() => {
    setDraftWidth(clampMediaWidth(node.attrs.width));
  }, [node.attrs.width]);

  const commitWidth = (value) => {
    const width = clampMediaWidth(value);
    setDraftWidth(width);
    updateAttributes({ width });
  };

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const editorSurface = rootRef.current?.closest(".ProseMirror");
    const editorRect = editorSurface?.getBoundingClientRect();
    if (!editorRect?.width) return;

    const startX = event.clientX;
    const startWidth = draftWidth;
    let latestWidth = startWidth;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);

    const move = (moveEvent) => {
      latestWidth = clampMediaWidth(startWidth + ((moveEvent.clientX - startX) / editorRect.width) * 100);
      setDraftWidth(latestWidth);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      updateAttributes({ width: latestWidth });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  };

  return (
    <NodeViewWrapper
      as={as}
      ref={rootRef}
      className={`tiptap-media-node ${className} ${selected ? "is-selected" : ""}`}
      data-width={draftWidth}
      data-media-node="true"
      style={{ width: `${draftWidth}%` }}
    >
      <div className="tiptap-media-controls" contentEditable={false}>
        <button type="button" data-drag-handle aria-label="拖曳移動" title="拖曳到文章中的其他位置">
          ⠿
        </button>
        <button type="button" aria-label="往上移" title="往上移" onClick={() => moveNode(editor, getPos, -1)}>
          ↑
        </button>
        <button type="button" aria-label="往下移" title="往下移" onClick={() => moveNode(editor, getPos, 1)}>
          ↓
        </button>
        <label title="調整寬度">
          <span>寬度</span>
          <input
            type="range"
            min={MIN_MEDIA_WIDTH}
            max={MAX_MEDIA_WIDTH}
            value={draftWidth}
            onChange={(event) => commitWidth(event.target.value)}
            aria-label="媒體寬度"
          />
          <output>{draftWidth}%</output>
        </label>
        <button type="button" className="danger" aria-label="從文章移除" title="從文章移除" onClick={deleteNode}>
          ×
        </button>
      </div>
      <div className="tiptap-media-content" contentEditable={false}>
        {children}
      </div>
      <button
        type="button"
        className="tiptap-media-resize-handle"
        contentEditable={false}
        aria-label="拖曳調整寬度"
        title="左右拖曳調整寬度"
        onPointerDown={startResize}
      />
    </NodeViewWrapper>
  );
}

function WeddingImageView(props) {
  const { node } = props;
  return (
    <MediaNodeShell {...props} as="figure" className="process-inline-image tiptap-image-node">
      <img src={node.attrs.src} alt={node.attrs.alt || ""} draggable={false} />
      {(node.attrs.caption || node.attrs.alt) && (
        <figcaption>{node.attrs.caption || node.attrs.alt}</figcaption>
      )}
    </MediaNodeShell>
  );
}

function AttachmentCardView(props) {
  const { node } = props;
  const size = formatBytes(node.attrs.byteSize);
  const extension = String(node.attrs.name || "附件").split(".").pop()?.toUpperCase();
  return (
    <MediaNodeShell {...props} className="process-attachment-line process-attachment-card tiptap-attachment-node">
      <a
        href={node.attrs.downloadUrl || node.attrs.href}
        target="_blank"
        rel="noopener noreferrer"
        download
        onClick={(event) => event.stopPropagation()}
      >
        <span className="process-attachment-icon" aria-hidden="true">📎</span>
        <span className="process-attachment-name">{node.attrs.name || "附件"}</span>
        <span className="process-attachment-meta">{[extension, size].filter(Boolean).join(" · ")}</span>
      </a>
    </MediaNodeShell>
  );
}

export const WeddingImage = Node.create({
  name: "weddingImage",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: 100 },
    };
  },

  parseHTML() {
    return [
      { tag: "figure.process-inline-image", getAttrs: readImageAttributes },
      { tag: "img[src]", getAttrs: readImageAttributes },
    ];
  },

  renderHTML({ node }) {
    const width = clampMediaWidth(node.attrs.width);
    return [
      "figure",
      { class: "process-inline-image", "data-width": String(width) },
      ["img", { src: node.attrs.src, alt: node.attrs.alt || "", loading: "lazy", decoding: "async" }],
      ["figcaption", {}, node.attrs.caption || node.attrs.alt || ""],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WeddingImageView);
  },
});

export const AttachmentCard = Node.create({
  name: "attachmentCard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: { default: "" },
      name: { default: "附件" },
      href: { default: "" },
      downloadUrl: { default: "" },
      mimeType: { default: "" },
      byteSize: { default: 0 },
      width: { default: 100 },
    };
  },

  parseHTML() {
    return [
      { tag: "div[data-type='attachment-card']", getAttrs: readAttachmentAttributes },
      { tag: "div.process-attachment-card", getAttrs: readAttachmentAttributes },
      { tag: "p.process-attachment-line", getAttrs: readAttachmentAttributes },
    ];
  },

  renderHTML({ node }) {
    const width = clampMediaWidth(node.attrs.width);
    const size = formatBytes(node.attrs.byteSize);
    return [
      "div",
      mergeAttributes({
        class: "process-attachment-line process-attachment-card",
        "data-type": "attachment-card",
        "data-width": String(width),
        "data-attachment-id": node.attrs.attachmentId || "",
        "data-name": node.attrs.name || "附件",
        "data-mime-type": node.attrs.mimeType || "",
        "data-byte-size": String(node.attrs.byteSize || 0),
      }),
      [
        "a",
        {
          href: node.attrs.downloadUrl || node.attrs.href,
          target: "_blank",
          rel: "noopener noreferrer",
          download: "",
        },
        ["span", { class: "process-attachment-icon" }, "📎"],
        ["span", { class: "process-attachment-name" }, node.attrs.name || "附件"],
        ["span", { class: "process-attachment-meta" }, size],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentCardView);
  },
});
