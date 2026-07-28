# Thumbnail delivery contract

The gallery uses compressed WebP derivatives. Original media is requested only by the fullscreen photo viewer. Missing derivatives are reused when discoverable or generated idempotently, then linked in PostgreSQL.
