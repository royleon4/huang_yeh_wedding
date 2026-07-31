function iconFor(albumId) {
  if (albumId === "wedding") return "♥";
  if (albumId === "guest") return "☻";
  if (albumId === "life") return "⌂";
  return "◆";
}

function CollectionButtons({ albums, active, isEnglish, onChoose }) {
  return albums.map((album) => (
    <button
      key={album.id}
      type="button"
      className={active === album.id ? "active" : ""}
      onClick={() => onChoose(album.id)}
      aria-current={active === album.id ? "page" : undefined}
    >
      <span className="bottom-nav-icon" aria-hidden="true">
        {iconFor(album.id)}
      </span>
      <small>{isEnglish ? album.en : album.zh}</small>
    </button>
  ));
}

export default function BottomCollectionNav({
  albums,
  active,
  isEnglish,
  onChoose,
  onUpload,
}) {
  const split = Math.ceil(albums.length / 2);

  return (
    <nav
      className="bottom-collection-nav"
      aria-label={isEnglish ? "Photo collections" : "照片分類"}
    >
      <div className="bottom-nav-side bottom-nav-left">
        <CollectionButtons
          albums={albums.slice(0, split)}
          active={active}
          isEnglish={isEnglish}
          onChoose={onChoose}
        />
      </div>

      <button
        type="button"
        className="bottom-upload-action"
        onClick={onUpload}
        aria-label={isEnglish ? "Upload photos" : "上傳照片"}
      >
        <span aria-hidden="true">＋</span>
        <strong>{isEnglish ? "Upload" : "上傳"}</strong>
      </button>

      <div className="bottom-nav-side bottom-nav-right">
        <CollectionButtons
          albums={albums.slice(split)}
          active={active}
          isEnglish={isEnglish}
          onChoose={onChoose}
        />
      </div>
    </nav>
  );
}
