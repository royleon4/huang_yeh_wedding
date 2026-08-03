# Unified document import and direct attachment upload

Date: 2026-08-03

## Administrator document import

The existing Word import control is now named `匯入文件` and accepts:

- `.docx`
- `.pdf`
- `.ppt`
- `.pptx`

The control stays in its existing toolbar position. No toolbar control order, editor layout, typography, spacing, colors, or DOM order changed.

Word documents continue to use the existing editable-or-fidelity decision. PDF and PowerPoint files are uploaded and inserted at the current cursor as page-faithful document blocks.

The generic `加入圖片或附件` selector no longer duplicates these four document formats. It remains available for images and other supported attachment types.

## Attachment upload transport

Process-content attachments no longer call `drive.uploadOriginal`, which can be wrapped by the global resumable/chunked upload setting.

They now call `drive.uploadAttachment`, which uses one Google Drive `uploadType=multipart` request containing metadata and the complete file body. It does not create a resumable session, does not set `Content-Range`, and does not split the file into chunks.

The existing 25 MB process-attachment limit remains unchanged.

## Diagnostics

Process-content multipart failures are logged as `attachment-upload`; thumbnail failures remain `thumbnail-upload`.

A `DRIVE_AUTHORIZATION_REQUIRED` response now explains that the failed attachment request used direct upload rather than chunking. A 403 after this change therefore points to Google Drive connector authorization or target-folder write permission, not chunk splitting.
