This directory implements Google Drive wedding-process folder reconciliation.

Public process responses omit Drive identifiers. Administrator category mutations are available only through the session-protected `/Memories/admin/api/categories*` routes. Authentication begins at `/Memories/admin/login` with the deployment `MEMORIES_ADMIN_TOKEN` and exchanges the password for a short-lived HttpOnly cookie.

Numbered Drive folders are canonical for process labels and ordering. Reserved folders are `00 未分類`, `訪客上傳`, `生活照` and `系統縮圖`. Category create, rename and reorder operations write to Drive before reflecting the result in PostgreSQL.
