import AdminFeatureSettings from "./AdminFeatureSettings.jsx";
import DriveUploadModeSettings from "./DriveUploadModeSettings.jsx";
import GalleryMediaOrderSettings from "./GalleryMediaOrderSettings.jsx";
import "./general-settings.css";

export default function GeneralSettings() {
  return (
    <section className="general-settings" aria-labelledby="general-settings-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">GENERAL SETTINGS</p>
          <h2 id="general-settings-title">通用設定</h2>
        </div>
        <span>全站共用</span>
      </div>
      <p className="admin-section-note">
        這裡只放會影響整個照片牆的設定，不會分散顯示在相簿、照片或分類頁面中。
      </p>
      <DriveUploadModeSettings />
      <GalleryMediaOrderSettings />
      <AdminFeatureSettings />
    </section>
  );
}
