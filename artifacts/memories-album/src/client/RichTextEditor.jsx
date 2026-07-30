import { useEffect, useRef, useState } from "react";
import "./rich-text-formatting.css";

const ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  "text/plain",
  ".zip",
].join(",");

const ALIGNMENT_CLASSES = [
  "process-align-left",
  "process-align-center",
  "process-align-right",
  "process-align-justify",
];

const ALIGNMENT_BY_COMMAND = {
  justifyLeft: "process-align-left",
  justifyCenter: "process-align-center",
  justifyRight: "process-align-right",
  justifyFull: "process-align-justify",
};

const ALIGNMENT_BY_VALUE = {
  left: "process-align-left",
  start: "process-align-left",
  center: "process-align-center",
  right: "process-align-right",
  end: "process-align-right",
  justify: "process-align-justify",
};

const EDITABLE_BLOCK_SELECTOR = "p,h2,h3,blockquote,li,div,figcaption";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function selectionNodeInside(editor, node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return Boolean(element && (element === editor || editor.contains(element)));
}

function selectedBlocks(editor, range) {
  if (!editor || !range) return [];
  const blocks = [...editor.querySelectorAll(EDITABLE_BLOCK_SELECTOR)].filter((element) => {
    try {
      return range.intersectsNode(element);
    } catch {
      return false;
    }
  });
  if (blocks.length > 0) {
    return blocks.filter(
      (candidate) => !blocks.some((other) => other !== candidate && candidate.contains(other)),
    );
  }

  let current =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
  while (current && current !== editor) {
    if (current.matches?.(EDITABLE_BLOCK_SELECTOR)) return [current];
    current = current.parentElement;
  }
  return [];
}

function normalizeAlignmentMarkup(editor) {
  if (!editor) return;
  const selector = ["[style]", "[align]", ...ALIGNMENT_CLASSES.map((name) => `.${name}`)].join(",");
  for (const element of editor.querySelectorAll(selector)) {
    const styleAlignment = element.style?.textAlign?.trim().toLowerCase();
    const legacyAlignment = element.getAttribute("align")?.trim().toLowerCase();
    const existingClass = ALIGNMENT_CLASSES.find((name) => element.classList.contains(name));
    const alignmentClass =
      ALIGNMENT_BY_VALUE[styleAlignment] || ALIGNMENT_BY_VALUE[legacyAlignment] || existingClass;

    element.classList.remove(...ALIGNMENT_CLASSES);
    if (alignmentClass) element.classList.add(alignmentClass);
    element.removeAttribute("align");
    if (element.style) {
      element.style.removeProperty("text-align");
      if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
    }
  }
}

function ToolbarButton({ label, children, disabled, onClick, pressed }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
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
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectionRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activeFormats, setActiveFormats] = useState({});

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    if (editor.innerHTML !== (value || "")) editor.innerHTML = value || "";
    normalizeAlignmentMarkup(editor);
  }, [value]);

  const captureSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!selectionNodeInside(editor, range.commonAncestorContainer)) return;
    selectionRef.current = range.cloneRange();
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
    });
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    editor.focus({ preventScroll: true });
    const saved = selectionRef.current;
    if (!saved || !selectionNodeInside(editor, saved.commonAncestorContainer)) return null;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(saved);
    return saved;
  };

  const emit = () => {
    const editor = editorRef.current;
    normalizeAlignmentMarkup(editor);
    onChange(editor?.innerHTML ?? "");
    captureSelection();
  };

  const run = (command, commandValue = null) => {
    if (disabled) return;
    restoreSelection();
    document.execCommand(command, false, commandValue);
    emit();
  };

  const align = (command) => {
    if (disabled) return;
    const editor = editorRef.current;
    const range = restoreSelection();
    if (!editor) return;
    const before = selectedBlocks(editor, range);
    for (const block of before) block.classList.remove(...ALIGNMENT_CLASSES);
    document.execCommand(command, false, null);
    const selection = window.getSelection();
    const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : range;
    const blocks = selectedBlocks(editor, activeRange);
    const alignmentClass = ALIGNMENT_BY_COMMAND[command];
    for (const block of blocks) {
      block.classList.remove(...ALIGNMENT_CLASSES);
      if (alignmentClass) block.classList.add(alignmentClass);
    }
    emit();
  };

  const addLink = () => {
    const raw = window.prompt("請輸入連結網址（https://…）");
    if (!raw) return;
    try {
      const url = new URL(raw, window.location.origin);
      if (!/^https?:$/.test(url.protocol)) throw new Error("invalid protocol");
      run("createLink", url.href);
    } catch {
      setUploadError("連結必須是有效的 http 或 https 網址。");
    }
  };

  const insertAttachment = (attachment) => {
    const name = escapeHtml(attachment.name);
    const url = escapeHtml(attachment.url);
    const downloadUrl = escapeHtml(attachment.downloadUrl || attachment.url);
    const html = attachment.isImage
      ? `<figure class="process-inline-image"><img src="${url}" alt="${name}" loading="lazy"><figcaption>${name}</figcaption></figure><p><br></p>`
      : `<p class="process-attachment-line"><a href="${downloadUrl}" target="_blank" rel="noopener" download>📎 ${name}</a></p>`;
    run("insertHTML", html);
  };

  const upload = async (file) => {
    if (!file || !onUploadAttachment) return;
    setUploading(true);
    setUploadError("");
    try {
      const attachment = await onUploadAttachment(file);
      insertAttachment(attachment);
    } catch (error) {
      setUploadError(error?.message || "附件上傳失敗，請再試一次。");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="process-rich-editor">
      <div className="process-rich-toolbar" role="toolbar" aria-label="文字格式工具列">
        <div className="process-rich-toolbar-group wide" role="group" aria-label="段落格式">
          <span className="process-rich-toolbar-label">段落</span>
          <select
            aria-label="段落格式"
            defaultValue="p"
            disabled={disabled}
            onMouseDown={captureSelection}
            onChange={(event) => run("formatBlock", event.target.value)}
          >
            <option value="p">內文</option>
            <option value="h2">大標題</option>
            <option value="h3">小標題</option>
            <option value="blockquote">引言</option>
          </select>
        </div>

        <div className="process-rich-toolbar-group" role="group" aria-label="文字樣式">
          <span className="process-rich-toolbar-label">文字</span>
          {[
            ["bold", "粗體", "B"],
            ["italic", "斜體", "I"],
            ["underline", "底線", "U"],
            ["strikeThrough", "刪除線", "S"],
          ].map(([command, label, text]) => (
            <ToolbarButton
              key={command}
              label={label}
              disabled={disabled}
              pressed={Boolean(activeFormats[command])}
              onClick={() => run(command)}
            >
              {text}
            </ToolbarButton>
          ))}
        </div>

        <div className="process-rich-toolbar-group wide" role="group" aria-label="段落對齊">
          <span className="process-rich-toolbar-label">對齊</span>
          {[
            ["justifyLeft", "置左", "左"],
            ["justifyCenter", "置中", "中"],
            ["justifyRight", "置右", "右"],
            ["justifyFull", "左右對齊（等寬）", "等寬"],
          ].map(([command, label, text]) => (
            <ToolbarButton
              key={command}
              label={label}
              disabled={disabled}
              onClick={() => align(command)}
            >
              {text}
            </ToolbarButton>
          ))}
        </div>

        <div className="process-rich-toolbar-group wide" role="group" aria-label="清單與縮排">
          <span className="process-rich-toolbar-label">清單與縮排</span>
          <ToolbarButton label="項目清單" disabled={disabled} onClick={() => run("insertUnorderedList")}>
            項目
          </ToolbarButton>
          <ToolbarButton label="編號清單" disabled={disabled} onClick={() => run("insertOrderedList")}>
            編號
          </ToolbarButton>
          <ToolbarButton label="減少縮排" disabled={disabled} onClick={() => run("outdent")}>
            ←縮排
          </ToolbarButton>
          <ToolbarButton label="增加縮排" disabled={disabled} onClick={() => run("indent")}>
            縮排→
          </ToolbarButton>
        </div>

        <div className="process-rich-toolbar-group wide" role="group" aria-label="連結與編輯">
          <span className="process-rich-toolbar-label">連結與編輯</span>
          <ToolbarButton label="新增連結" disabled={disabled} onClick={addLink}>
            連結
          </ToolbarButton>
          <ToolbarButton label="移除連結" disabled={disabled} onClick={() => run("unlink")}>
            取消連結
          </ToolbarButton>
          <ToolbarButton label="復原" disabled={disabled} onClick={() => run("undo")}>
            復原
          </ToolbarButton>
          <ToolbarButton label="重做" disabled={disabled} onClick={() => run("redo")}>
            重做
          </ToolbarButton>
          <ToolbarButton label="清除所選文字格式" disabled={disabled} onClick={() => run("removeFormat")}>
            清除格式
          </ToolbarButton>
        </div>

        <div className="process-rich-toolbar-group" role="group" aria-label="附件">
          <span className="process-rich-toolbar-label">附件</span>
          <ToolbarButton
            label="插入圖片或附件"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "上傳中…" : "圖片／附件"}
          </ToolbarButton>
          <input
            ref={fileInputRef}
            className="process-rich-file-input"
            type="file"
            accept={ATTACHMENT_ACCEPT}
            disabled={disabled || uploading}
            onChange={(event) => void upload(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <p className="process-rich-selection-hint">
        先反白選取文字或多個段落，或把游標放在該行，再按上方格式；對齊與段落格式會套用到所選行。
      </p>
      <div
        ref={editorRef}
        className="process-rich-editable"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder="在這裡輸入文字，或插入圖片與附件…"
        onInput={emit}
        onBlur={emit}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
        onFocus={captureSelection}
      />
      {uploadError && <p className="admin-form-error">{uploadError}</p>}
      {attachments.length > 0 && (
        <div className="process-attachment-library">
          <strong>已上傳附件</strong>
          <div>
            {attachments.map((attachment) => (
              <span key={attachment.id}>
                <a href={attachment.downloadUrl || attachment.url} target="_blank" rel="noreferrer">
                  {attachment.isImage ? "圖片" : "附件"} · {attachment.name}（{formatBytes(attachment.byteSize)}）
                </a>
                {onDeleteAttachment && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDeleteAttachment(attachment)}
                  >
                    移除
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
