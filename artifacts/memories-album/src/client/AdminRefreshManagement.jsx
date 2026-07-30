import AdminRefreshButton from "./AdminRefreshButton.jsx";
import "./admin-refresh-management.css";

function itemLabel(item, fallback) {
  return item?.titleZh || item?.labelZh || item?.titleEn || item?.labelEn || fallback;
}

export default function AdminRefreshManagement({ albums = [], categories = [] }) {
  return (
    <section
      className="admin-refresh-management"
      aria-labelledby="admin-refresh-management-title"
    >
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">MAINTENANCE</p>
          <h2 id="admin-refresh-management-title">重新整理原始照片</h2>
        </div>
        <span>高風險操作集中區</span>
      </div>

      <p className="admin-section-note">
        只有需要重新掃描 Google Drive 原始資料夾或更新縮圖時才使用。每次操作都只影響所選相簿或流程，原始照片不會被刪除。
      </p>

      <div className="admin-refresh-warning" role="note">
        <strong>避免誤按</strong>
        <p>
          重新整理會刪除所選範圍內的衍生縮圖，再重新掃描原始資料夾並重建。按下後仍會再次要求確認。
        </p>
      </div>

      <div className="admin-refresh-management-grid">
        <section aria-labelledby="album-refresh-list-title">
          <div className="admin-refresh-list-heading">
            <h3 id="album-refresh-list-title">相簿</h3>
            <span>{albums.length} 個</span>
          </div>
          <div className="admin-refresh-list">
            {albums.map((album) => (
              <article key={album.id}>
                <div>
                  <strong>{itemLabel(album, album.id)}</strong>
                  <small>{album.id}</small>
                </div>
                <AdminRefreshButton
                  scopeType="album"
                  scopeId={album.id}
                  label={itemLabel(album, album.id)}
                />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="process-refresh-list-title">
          <div className="admin-refresh-list-heading">
            <h3 id="process-refresh-list-title">婚禮流程</h3>
            <span>{categories.length} 個</span>
          </div>
          <div className="admin-refresh-list">
            {categories.map((category) => (
              <article key={category.id}>
                <div>
                  <strong>{itemLabel(category, category.id)}</strong>
                  <small>{category.id}</small>
                </div>
                <AdminRefreshButton
                  scopeType="process"
                  scopeId={category.id}
                  label={itemLabel(category, category.id)}
                />
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
