import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { AttachmentCard, WeddingImage } from "./TiptapMediaNodes.jsx";
import { PageDocument } from "./TiptapPageDocumentNode.jsx";
import { WordDocument } from "./TiptapWordDocumentNode.jsx";
import {
  isPageDocumentAttachment,
  pageDocumentKind,
  pageDocumentLabel,
} from "./page-document.mjs";
import {
  convertWordFileToHtml,
  describeWordImport,
  WORD_IMPORT_ACCEPT,
  WORD_IMPORT_MAX_HTML_CHARACTERS,
} from "./word-import.mjs";
import "./rich-text-formatting.css";
import "./rich-text-mobile.css";
import "./rich-text-media-editor.css";
import "./page-document.css";
import "./word-document.css";

const DOCUMENT_IMPORT_ACCEPT = [
  WORD_IMPORT_ACCEPT,
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf",
  ".ppt",
  ".pptx",
].join(",");

const ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  ".doc",
  ".xls",
  ".xlsx",
  "text/plain",
  ".zip",
].join(",");

const ALIGNMENT_BY_CLASS = {
  "process-align-left": "left",
  "process-align-center": "center",
  "process-align-right": "right",
  "process-align-justify": "justify",
};

function prepareEditorHtml(value) {
  const html = String(value ?? "").trim();
  if (!html || typeof DOMParser === "undefined") return html || "<p></p>";
  const documentNode = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = documentNode.body.firstElementChild;
  if (!root) return html;
  for (const element of root.querySelectorAll(Object.keys(ALIGNMENT_BY_CLASS).map((name) => `.${name}`).join(","))) {
    const className = Object.keys(ALIGNMENT_BY_CLASS).find((name) => element.classList.contains(name));
    if (className) element.style.textAlign = ALIGNMENT_BY_CLASS[className];
  }
  return root.innerHTML || "<p></p>";
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeHttpUrl(raw) {
  try {
    const url = new URL(raw, window.location.origin);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function ToolbarButton({ label, icon, active = false, disabled = false, onClick, wide = false }) {
  return (
    <button
      type="button"
      className={`tiptap-toolbar-button ${active ? "is-active" : ""} ${wide ? "is-wide" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{icon}</span>
      {wide && <small>{label}</small>}
    </button>
  );
}

function TextBubbleMenu({ editor }) {
  if (!editor) return null;
  return (
    <BubbleMenu
      editor={editor}
      className="tiptap-bubble-menu"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current, from, to }) =>
        from !== to &&
        !current.isActive("weddingImage") &&
        !current.isActive("attachmentCard") &&
        !current.isActive("wordDocument") &&
        !current.isActive("pageDocument")
      }
    >
      <ToolbarButton label="粗體" icon="B" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton label="斜體" icon="I" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton label="底線" icon="U" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolbarButton label="刪除線" icon="S" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolbarButton label="連結" icon="↗" active={editor.isActive("link")} onClick={() => {
        const current = editor.getAttributes("link").href || "https://";
        const raw = window.prompt("請輸入連結網址", current);
        if (raw === null) return;
        const href = safeHttpUrl(raw);
        if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }} />
    </BubbleMenu>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  onUploadAttachment,
  attachments = [],
  onDeleteAttachment,
  ariaLabel,
}) {
  const fileInputRef = useRef(null);
  const wordInputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef("");
  const [uploading, setUploading] = useState(false);
  const [importingWord, setImportingWord] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [, setRevision] = useState(0);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Placeholder.configure({
        placeholder: "在這裡輸入文字，或加入可拖曳的圖片與附件…",
      }),
      WeddingImage,
      AttachmentCard,
      WordDocument,
      PageDocument,
    ],
    content: prepareEditorHtml(value),
    editorProps: {
      attributes: {
        class: "process-rich-editable tiptap-editor-surface",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel || "文章內容",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      lastEmittedRef.current = html;
      onChangeRef.current?.(html);
      setRevision((revision) => revision + 1);
    },
    onSelectionUpdate: () => setRevision((revision) => revision + 1),
    onTransaction: () => setRevision((revision) => revision + 1),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const next = prepareEditorHtml(value);
    if (value === lastEmittedRef.current || editor.getHTML() === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps?.attributes,
          "aria-label": ariaLabel || "文章內容",
        },
      },
    });
  }, [ariaLabel, editor]);

  const insertAttachment = (attachment) => {
    if (!editor || !attachment) return;
    const kind = pageDocumentKind(attachment);
    let node;
    if (attachment.isImage) {
      node = {
        type: "weddingImage",
        attrs: {
          src: attachment.url,
          alt: attachment.name || "",
          caption: attachment.name || "",
          width: 100,
        },
      };
    } else if (kind) {
      node = {
        type: "pageDocument",
        attrs: {
          attachmentId: attachment.id || "",
          name: attachment.name || pageDocumentLabel(kind),
          src: attachment.url || attachment.downloadUrl || "",
          downloadUrl: attachment.downloadUrl || attachment.url || "",
          mimeType: attachment.mimeType || "",
          kind,
        },
      };
    } else {
      node = {
        type: "attachmentCard",
        attrs: {
          attachmentId: attachment.id || "",
          name: attachment.name || "附件",
          href: attachment.url || attachment.downloadUrl || "",
          downloadUrl: attachment.downloadUrl || attachment.url || "",
          mimeType: attachment.mimeType || "",
          byteSize: Number(attachment.byteSize || 0),
          width: 82,
        },
      };
    }
    editor.chain().focus().insertContent([node, { type: "paragraph" }]).run();
  };

  const upload = async (file) => {
    if (!file || !onUploadAttachment || !editor) return;
    setUploading(true);
    setUploadError("");
    setImportMessage("");
    try {
      const attachment = await onUploadAttachment(file);
      insertAttachment(attachment);
      if (isPageDocumentAttachment(attachment)) {
        const kind = pageDocumentKind(attachment);
        setImportMessage(
          `已將「${attachment.name || pageDocumentLabel(kind)}」以${pageDocumentLabel(kind)}保真區塊插入游標位置。`,
        );
      }
    } catch (error) {
      setUploadError(error?.message || "附件上傳失敗，請再試一次。");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importWord = async (file) => {
    if (!file || !editor) return;
    setImportingWord(true);
    setUploadError("");
    setImportMessage("");
    try {
      const result = await convertWordFileToHtml(file, {
        uploadImage: onUploadAttachment,
        uploadDocument: onUploadAttachment,
      });
      const combinedLength =
        Array.from(editor.getHTML()).length + Array.from(result.html).length;
      if (combinedLength > WORD_IMPORT_MAX_HTML_CHARACTERS) {
        throw new Error("匯入後的文章內容過長，請拆分 Word 文件後再匯入。");
      }

      if (result.mode === "fidelity") {
        const attachment = result.documentAttachment;
        editor
          .chain()
          .focus()
          .insertContent([
            {
              type: "wordDocument",
              attrs: {
                attachmentId: attachment?.id || "",
                name: attachment?.name || result.fileName,
                src: attachment?.url || attachment?.downloadUrl || "",
                downloadUrl: attachment?.downloadUrl || attachment?.url || "",
                reasons: result.fidelity?.reasons?.join("、") || "條件式保真模式",
              },
            },
            { type: "paragraph" },
          ])
          .run();
      } else {
        editor.chain().focus().insertContent(`${result.html}<p></p>`).run();
      }
      setImportMessage(describeWordImport(result));
    } catch (error) {
      setUploadError(error?.message || "Word 文件匯入失敗，請確認檔案後再試一次。");
    } finally {
      setImportingWord(false);
      if (wordInputRef.current) wordInputRef.current.value = "";
    }
  };

  const importDocument = async (file) => {
    if (!file) return;
    const kind = pageDocumentKind({ name: file.name, mimeType: file.type });
    if (kind) {
      await upload(file);
      if (wordInputRef.current) wordInputRef.current.value = "";
      return;
    }
    await importWord(file);
  };

  const setBlock = (value) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === "h2") chain.setHeading({ level: 2 }).run();
    else if (value === "h3") chain.setHeading({ level: 3 }).run();
    else if (value === "blockquote") chain.toggleBlockquote().run();
    else chain.setParagraph().run();
  };

  const addLink = () => {
    if (!editor) return;
    const current = editor.getAttributes("link").href || "https://";
    const raw = window.prompt("請輸入連結網址", current);
    if (raw === null) return;
    if (!raw.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = safeHttpUrl(raw);
    if (!href) {
      setUploadError("連結必須是有效的 http 或 https 網址。");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const blockValue = editor?.isActive("heading", { level: 2 })
    ? "h2"
    : editor?.isActive("heading", { level: 3 })
      ? "h3"
      : editor?.isActive("blockquote")
        ? "blockquote"
        : "p";

  return (
    <div className="process-rich-editor tiptap-rich-editor">
      <div className="tiptap-editor-header">
        <div className="tiptap-toolbar" role="toolbar" aria-label="文章格式工具列">
          <label className="tiptap-block-select">
            <span className="sr-only">段落格式</span>
            <select value={blockValue} disabled={disabled || !editor} onChange={(event) => setBlock(event.target.value)}>
              <option value="p">內文</option>
              <option value="h2">大標題</option>
              <option value="h3">小標題</option>
              <option value="blockquote">引言</option>
            </select>
          </label>

          <span className="tiptap-toolbar-divider" />
          <ToolbarButton label="粗體" icon="B" active={Boolean(editor?.isActive("bold"))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleBold().run()} />
          <ToolbarButton label="斜體" icon="I" active={Boolean(editor?.isActive("italic"))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleItalic().run()} />
          <ToolbarButton label="底線" icon="U" active={Boolean(editor?.isActive("underline"))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
          <ToolbarButton label="刪除線" icon="S" active={Boolean(editor?.isActive("strike"))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleStrike().run()} />

          <span className="tiptap-toolbar-divider" />
          <ToolbarButton label="置左" icon="≡" active={Boolean(editor?.isActive({ textAlign: "left" }))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
          <ToolbarButton label="置中" icon="≣" active={Boolean(editor?.isActive({ textAlign: "center" }))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
          <ToolbarButton label="置右" icon="≡›" active={Boolean(editor?.isActive({ textAlign: "right" }))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().setTextAlign("right").run()} />
          <ToolbarButton label="左右等寬" icon="☰" active={Boolean(editor?.isActive({ textAlign: "justify" }))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().setTextAlign("justify").run()} />

          <span className="tiptap-toolbar-divider" />
          <ToolbarButton label="項目清單" icon="•≡" active={Boolean(editor?.isActive("bulletList"))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
          <ToolbarButton label="編號清單" icon="1≡" active={Boolean(editor?.isActive("orderedList"))} disabled={disabled || !editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
          <ToolbarButton label="減少縮排" icon="⇤" disabled={disabled || !editor} onClick={() => editor?.chain().focus().liftListItem("listItem").run()} />
          <ToolbarButton label="增加縮排" icon="⇥" disabled={disabled || !editor} onClick={() => editor?.chain().focus().sinkListItem("listItem").run()} />

          <span className="tiptap-toolbar-divider" />
          <ToolbarButton label="新增或編輯連結" icon="↗" active={Boolean(editor?.isActive("link"))} disabled={disabled || !editor} onClick={addLink} />
          <ToolbarButton label="取消連結" icon="⊘" disabled={disabled || !editor || !editor?.isActive("link")} onClick={() => editor?.chain().focus().unsetLink().run()} />
          <ToolbarButton label="復原" icon="↶" disabled={disabled || !editor || !editor.can().chain().focus().undo().run()} onClick={() => editor?.chain().focus().undo().run()} />
          <ToolbarButton label="重做" icon="↷" disabled={disabled || !editor || !editor.can().chain().focus().redo().run()} onClick={() => editor?.chain().focus().redo().run()} />
          <ToolbarButton label="清除格式" icon="Tx" disabled={disabled || !editor} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />

          <span className="tiptap-toolbar-spacer" />
          <ToolbarButton
            label={importingWord || uploading ? "匯入中" : "匯入文件"}
            icon={importingWord || uploading ? "…" : "檔"}
            wide
            disabled={disabled || importingWord || uploading || !editor}
            onClick={() => wordInputRef.current?.click()}
          />
          <input
            ref={wordInputRef}
            className="process-rich-file-input"
            type="file"
            accept={DOCUMENT_IMPORT_ACCEPT}
            disabled={disabled || importingWord || uploading}
            onChange={(event) => void importDocument(event.target.files?.[0] ?? null)}
          />
          <ToolbarButton
            label={uploading ? "上傳中" : "加入圖片或附件"}
            icon={uploading ? "…" : "＋"}
            wide
            disabled={disabled || uploading || importingWord || !editor}
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            className="process-rich-file-input"
            type="file"
            accept={ATTACHMENT_ACCEPT}
            disabled={disabled || uploading || importingWord}
            onChange={(event) => void upload(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <p className="tiptap-editor-hint">
        反白文字可快速套用格式。手機請點選圖片或附件後使用移動與寬度控制；桌面仍可拖曳，並可拉動把手調整大小。「匯入文件」支援 .docx、.pdf、.ppt 與 .pptx。Word 會自動判斷可編輯或保真模式；PDF 與 PowerPoint 會在游標位置插入保留原頁面或投影片配置的文件區塊。
      </p>

      <div className="tiptap-editor-frame">
        <TextBubbleMenu editor={editor} />
        <EditorContent editor={editor} />
      </div>

      {uploadError && <p className="admin-form-error">{uploadError}</p>}
      {importMessage && <p className="process-content-success" role="status">{importMessage}</p>}

      {attachments.length > 0 && (
        <details className="process-attachment-library">
          <summary>已上傳素材（{attachments.length}）</summary>
          <div className="process-attachment-library-grid">
            {attachments.map((attachment) => (
              <article key={attachment.id}>
                <div>
                  <strong>{attachment.isImage ? "圖片" : "附件"}</strong>
                  <span>{attachment.name}</span>
                  <small>{formatBytes(attachment.byteSize)}</small>
                </div>
                <div className="process-attachment-library-actions">
                  <button type="button" disabled={disabled || !editor} onClick={() => insertAttachment(attachment)}>
                    插入文章
                  </button>
                  <a href={attachment.downloadUrl || attachment.url} target="_blank" rel="noreferrer">
                    開啟
                  </a>
                  {onDeleteAttachment && (
                    <button type="button" className="danger" disabled={disabled} onClick={() => onDeleteAttachment(attachment)}>
                      移除檔案
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
