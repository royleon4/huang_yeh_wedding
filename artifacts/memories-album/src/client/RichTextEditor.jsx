import { useEffect, useRef, useState } from "react";

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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    if (editor.innerHTML !== (value || "")) editor.innerHTML = value || "";
  }, [value]);

  const emit = () => onChange(editorRef.current?.innerHTML ?? "");

  const run = (command, commandValue = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
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
        <select
          aria-label="段落格式"
          defaultValue="p"
          disabled={disabled}
          onChange={(event) => run("formatBlock", event.target.value)}
        >
          <option value="p">內文</option>
          <option value="h2">大標題</option>
          <option value="h3">小標題</option>
          <option value="blockquote">引言</option>
        </select>
        {[
          ["bold", "粗體", "B"],
          ["italic", "斜體", "I"],
          ["underline", "底線", "U"],
        ].map(([command, label, text]) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(command)}
          >
            {text}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run("insertUnorderedList")}
        >
          項目
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run("insertOrderedList")}
        >
          編號
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={addLink}
        >
          連結
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run("removeFormat")}
        >
          清除格式
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "上傳中…" : "圖片／附件"}
        </button>
        <input
          ref={fileInputRef}
          className="process-rich-file-input"
          type="file"
          accept={ATTACHMENT_ACCEPT}
          disabled={disabled || uploading}
          onChange={(event) => void upload(event.target.files?.[0] ?? null)}
        />
      </div>
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
