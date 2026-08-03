# Word import and image upload scope

Date: 2026-08-03

## Editor controls

- **匯入 Word** accepts only `.docx`.
- **加入圖片** accepts only JPEG, PNG, WebP, and GIF.
- PDF, PPT, PPTX, Excel, text, ZIP, and generic attachment-card creation were removed.

The controls remain in their existing toolbar positions. No layout, spacing, typography, color, size, or DOM order was changed.

## Word behavior

DOCX files continue to use the existing conditional importer:

- ordinary content becomes editable rich text
- documents with tables, pages, headers, footers, advanced typography, or positioned objects use the Word fidelity block
- embedded Word images use the same image storage endpoint
- a fidelity block retains the original DOCX source

## Storage boundary

The process-content upload endpoint accepts only supported image formats and DOCX. It continues to use one Google Drive multipart request without a resumable session, Content-Range, or chunk splitting.

## Removed implementation

- PDF.js and the PDF page renderer
- PowerPoint PPTX renderer and legacy PPT viewer
- page-document Tiptap node and public hydration
- generic attachment-card Tiptap node and creation controls
- PDF/PPT browser geometry test and associated dependencies
