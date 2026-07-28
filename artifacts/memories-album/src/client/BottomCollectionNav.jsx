import { useEffect, useState } from "react";

const COLLECTIONS = [
  { id: "wedding", zh: "婚禮流程", en: "Wedding" },
  { id: "guest", zh: "訪客上傳", en: "Guests" },
  { id: "life", zh: "生活照", en: "Life" },
];

function currentCollection() {
  const tabs = [...document.querySelectorAll(".collection-tab")];
  const index = tabs.findIndex((tab) => tab.classList.contains("active"));
  return COLLECTIONS[index]?.id ?? "wedding";
}

function clickCollection(collectionId) {
  const index = COLLECTIONS.findIndex((item) => item.id === collectionId);
  document.querySelectorAll(".collection-tab")[index]?.click();
}

function openUpload() {
  document.querySelector(".floating-upload-button")?.click();
}

export default function BottomCollectionNav() {
  const [active, setActive] = useState("wedding");
  const [isEnglish, setIsEnglish] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setActive(currentCollection());
      setIsEnglish(document.documentElement.lang === "en");
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "lang"],
    });
    return () => observer.disconnect();
  }, []);

  const label = (item) => (isEnglish ? item.en : item.zh);

  return (
    <nav className="bottom-collection-nav" aria-label={isEnglish ? "Photo collections" : "照片分類"}>
      <div className="bottom-nav-side bottom-nav-left">
        {COLLECTIONS.slice(0, 2).map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? "active" : ""}
            onClick={() => clickCollection(item.id)}
            aria-current={active === item.id ? "page" : undefined}
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
        aria-label={isEnglish ? "Upload photos" : "上傳照片"}
      >
        <span aria-hidden="true">＋</span>
        <strong>{isEnglish ? "Upload" : "上傳"}</strong>
      </button>

      <div className="bottom-nav-side bottom-nav-right">
        <button
          type="button"
          className={active === "life" ? "active" : ""}
          onClick={() => clickCollection("life")}
          aria-current={active === "life" ? "page" : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">⌂</span>
          <small>{label(COLLECTIONS[2])}</small>
        </button>
      </div>
    </nav>
  );
}
