import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import BatchManagementPage from "./BatchManagementPage.jsx";
import BottomCollectionNav from "./BottomCollectionNav.jsx";
import { MemoriesStateProvider } from "./MemoriesState.jsx";
import ProcessSyncAdmin from "./ProcessSyncAdmin.jsx";
import { parsePrivateBatchLocation } from "./batch-management-client.mjs";
import "./styles.css";
import "./collections.css";
import "./upload.css";
import "./process-sync.css";
import "./photo-lightbox.css";
import "./feature-controls.css";
import "./bottom-collection-nav.css";
import "./batch-management.css";
import "./bulk-photo-admin.css";

function MemoriesRoot() {
  return (
    <MemoriesStateProvider>
      <App />
      <ProcessSyncAdmin />
      <BottomCollectionNav />
    </MemoriesStateProvider>
  );
}

const privateBatchRoute = parsePrivateBatchLocation(
  window.location.pathname,
  window.location.hash,
);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {privateBatchRoute ? <BatchManagementPage /> : <MemoriesRoot />}
  </React.StrictMode>,
);
