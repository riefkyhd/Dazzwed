# Google Drive Resumable Upload Rules

1. When initializing Google Drive resumable upload sessions in Next.js/Node API routes, do NOT rely on `drive.files.create({ uploadType: 'resumable' })` to return HTTP headers without an active file stream.
2. ALWAYS use a direct `fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", ...)` with `Authorization: Bearer <token>`, `Origin: <client-origin>`, and upload metadata headers to guarantee extraction of the `location` header for browser direct PUT uploading.
