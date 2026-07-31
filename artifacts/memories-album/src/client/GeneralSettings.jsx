import AdminFeatureSettings from "./AdminFeatureSettings.jsx";
import DriveUploadModeSettings from "./DriveUploadModeSettings.jsx";
import GalleryMediaOrderSettings from "./GalleryMediaOrderSettings.jsx";
import GuestLabelSettings from "./GuestLabelSettings.jsx";
import ProcessSelectorSettings from "./ProcessSelectorSettings.jsx";
import WebsiteCopySettings from "./WebsiteCopySettings.jsx";
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
        這裡集中會影響整個照片牆的設定，包括子分類操作方式。修改後請使用頁面底部的「儲存所有變更」。
      </p>
      <WebsiteCopySettings />
      <DriveUploadModeSettings />
      <GalleryMediaOrderSettings />
      <GuestLabelSettings />
      <ProcessSelectorSettings />
      <AdminFeatureSettings />
    </section>
  );
}
