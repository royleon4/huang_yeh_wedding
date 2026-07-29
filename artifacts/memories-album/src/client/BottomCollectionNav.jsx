import { useMemoriesState } from "./MemoriesState.jsx";

const COLLECTIONS = [
  { id: "wedding", zh: "婚禮流程", en: "Wedding" },
  { id: "guest", zh: "訪客上傳", en: "Guests" },
  { id: "life", zh: "生活照", en: "Life" },
];

export default function BottomCollectionNav() {
  const {
    activeCollection,
    adminAuthenticated,
    albumOpen,
    lang,
    openUpload,
    selectCollection,
  } = useMemoriesState();
  const label = (item) => item[lang];

  return (
    <nav
      className="bottom-collection-nav"
      aria-label={lang === "en" ? "Photo collections" : "照片分類"}
    >
      <div className="bottom-nav-side bottom-nav-left">
        {COLLECTIONS.slice(0, 2).map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeCollection === item.id ? "active" : ""}
            onClick={() => selectCollection(item.id)}
            aria-current={activeCollection === item.id ? "page" : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {item.id === "wedding" ? "♥" : "☻"}
            </span>
            <small>{label(item)}</small>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="bottom-upload-action"
        onClick={openUpload}
        disabled={!albumOpen && !adminAuthenticated}
        aria-label={lang === "en" ? "Upload photos" : "上傳照片"}
      >
        <span aria-hidden="true">＋</span>
        <strong>{lang === "en" ? "Upload" : "上傳"}</strong>
      </button>

      <div className="bottom-nav-side bottom-nav-right">
        <button
          type="button"
          className={activeCollection === "life" ? "active" : ""}
          onClick={() => selectCollection("life")}
          aria-current={activeCollection === "life" ? "page" : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            ⌂
          </span>
          <small>{label(COLLECTIONS[2])}</small>
        </button>
      </div>
    </nav>
  );
}
