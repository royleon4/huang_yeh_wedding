import "./pinned-photos.css";

export default function PinnedPhotoStrip({ photos, copy, onOpen }) {
  if (!Array.isArray(photos) || photos.length === 0) return null;

  return (
    <section
      className="pinned-photo-stack"
      aria-label={copy?.pinnedPhotos ?? "置頂照片"}
    >
      {photos.slice(0, 3).map((photo, index) => (
        <article className="pinned-photo-card" key={photo.id}>
          <button
            type="button"
            className="pinned-photo-open"
            onClick={(event) => onOpen?.(photo, event.currentTarget)}
            aria-label={`${copy?.photo ?? "照片"} ${index + 1}`}
          >
            <img
              src={photo.thumbnailUrl}
              alt={photo.displayName || `${copy?.photo ?? "照片"} ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              width={photo.width}
              height={photo.height}
            />
            <span className="pinned-photo-rank" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
          </button>
        </article>
      ))}
    </section>
  );
}
