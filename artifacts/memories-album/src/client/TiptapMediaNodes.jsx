import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

export const MIN_MEDIA_WIDTH = 24;
export const MAX_MEDIA_WIDTH = 100;
const WIDTH_PRESETS = [25, 50, 75, 100];

export function clampMediaWidth(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace("%", ""));
  if (!Number.isFinite(parsed)) return MAX_MEDIA_WIDTH;
  return Math.max(MIN_MEDIA_WIDTH, Math.min(MAX_MEDIA_WIDTH, Math.round(parsed)));
}

function readImageAttributes(element) {
  const image =
    String(element?.tagName ?? "").toUpperCase() === "IMG"
      ? element
      : element?.querySelector?.("img");
  const caption =
    element?.querySelector?.("figcaption")?.textContent?.trim() ?? "";
  const width =
    element?.getAttribute?.("data-width") ||
    element?.style?.width ||
    image?.getAttribute?.("data-width") ||
    image?.style?.width ||
    100;

  return {
    src: image?.getAttribute?.("src") ?? "",
    alt: image?.getAttribute?.("alt") ?? "",
    caption,
    width: clampMediaWidth(width),
  };
}

function moveNode(editor, getPos, destination) {
  const position = typeof getPos === "function" ? getPos() : undefined;
  if (!Number.isInteger(position)) return false;

  const current = editor.state.doc.nodeAt(position);
  if (!current) return false;

  const transaction = editor.state.tr;
  let target = null;

  if (destination === "first") {
    transaction.delete(position, position + current.nodeSize);
    target = 0;
  } else if (destination === "last") {
    transaction.delete(position, position + current.nodeSize);
    target = transaction.doc.content.size;
  } else if (destination === "previous") {
    const previous = editor.state.doc.resolve(position).nodeBefore;
    if (!previous) return false;
    target = position - previous.nodeSize;
    transaction.delete(position, position + current.nodeSize);
  } else if (destination === "next") {
    const nextPosition = position + current.nodeSize;
    const next = editor.state.doc.nodeAt(nextPosition);
    if (!next) return false;
    transaction.delete(position, position + current.nodeSize);
    target = position + next.nodeSize;
  }

  if (!Number.isInteger(target)) return false;
  transaction.insert(target, current);
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function controlAction(event, action) {
  event.preventDefault();
  event.stopPropagation();
  action();
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

  const selectNode = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const position = typeof getPos === "function" ? getPos() : undefined;
    if (!Number.isInteger(position)) return;
    event.preventDefault();
    event.stopPropagation();
    editor.commands.setNodeSelection(position);
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
      latestWidth = clampMediaWidth(
        startWidth + ((moveEvent.clientX - startX) / editorRect.width) * 100,
      );
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
      <div
        className="tiptap-media-content"
        contentEditable={false}
        onPointerDown={selectNode}
        aria-label="選取此媒體以調整位置與大小"
      >
        {children}
      </div>

      <div className="tiptap-media-controls" contentEditable={false}>
        <div className="tiptap-media-actions" role="toolbar" aria-label="媒體位置操作">
          <button
            type="button"
            data-drag-handle
            data-desktop-drag-handle
            aria-label="桌面拖曳移動"
            title="桌面版可拖曳到文章中的其他位置"
          >
            ⠿
          </button>
          <button type="button" aria-label="移到最前" title="移到文章最前方" onClick={(event) => controlAction(event, () => moveNode(editor, getPos, "first"))}>
            ⇤
          </button>
          <button type="button" aria-label="往上移" title="往上移一段" onClick={(event) => controlAction(event, () => moveNode(editor, getPos, "previous"))}>
            ↑
          </button>
          <button type="button" aria-label="往下移" title="往下移一段" onClick={(event) => controlAction(event, () => moveNode(editor, getPos, "next"))}>
            ↓
          </button>
          <button type="button" aria-label="移到最後" title="移到文章最後方" onClick={(event) => controlAction(event, () => moveNode(editor, getPos, "last"))}>
            ⇥
          </button>
          <button type="button" className="danger" aria-label="從文章移除" title="只從文章移除，不會刪除已上傳檔案" onClick={(event) => controlAction(event, deleteNode)}>
            ×
          </button>
        </div>

        <div className="tiptap-media-size-controls" aria-label="媒體顯示寬度">
          <span className="tiptap-media-control-label">顯示寬度</span>
          <div className="tiptap-media-presets">
            {WIDTH_PRESETS.map((width) => (
              <button
                key={width}
                type="button"
                className={draftWidth === width ? "is-active" : ""}
                aria-pressed={draftWidth === width}
                aria-label={`設為 ${width}%`}
                onClick={(event) => controlAction(event, () => commitWidth(width))}
              >
                {width}%
              </button>
            ))}
          </div>
          <label title="精細調整寬度">
            <span className="sr-only">媒體寬度</span>
            <input
              type="range"
              min={MIN_MEDIA_WIDTH}
              max={MAX_MEDIA_WIDTH}
              value={draftWidth}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => commitWidth(event.target.value)}
              aria-label="媒體寬度"
            />
            <output>{draftWidth}%</output>
          </label>
        </div>
      </div>

      <button
        type="button"
        className="tiptap-media-resize-handle"
        contentEditable={false}
        aria-label="拖曳調整寬度"
        title="桌面版可左右拖曳調整寬度"
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
      {(node.attrs.caption || node.attrs.alt) && <figcaption>{node.attrs.caption || node.attrs.alt}</figcaption>}
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
