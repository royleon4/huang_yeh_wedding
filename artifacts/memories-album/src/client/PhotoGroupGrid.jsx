import LazyImage from "./LazyImage.jsx";

export default function PhotoGroupGrid({
  photos,
  allVisiblePhotos,
  copy,
  getCollectionLabel,
  onOpen,
  mediaKey,
}) {
  if (!photos.length) return null;

  return (
    <section className="process-photo-group" data-media-block={mediaKey}>
      <div className="masonry-grid">
        {photos.map((photo) => {
          const index = Math.max(
            0,
            allVisiblePhotos.findIndex((item) => item.id === photo.id),
          );
          return (
            <article className="photo-card" key={photo.id}>
              <button
                type="button"
                className="photo-open"
                onClick={(event) => onOpen(photo, event.currentTarget)}
                aria-label={`${copy.photo} ${index + 1}`}
              >
                <LazyImage
                  src={photo.thumbnailUrl}
                  alt={`${copy.photo} ${index + 1}`}
                  width={photo.width}
                  height={photo.height}
                />
                <span className="photo-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
              <footer>
                <span>{getCollectionLabel(photo)}</span>
                <small>{photo.uploaderName}</small>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
