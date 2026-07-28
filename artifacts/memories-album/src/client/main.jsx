import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ProcessSyncAdmin from "./ProcessSyncAdmin.jsx";
import ProcessCategoryDeleteControls from "./ProcessCategoryDeleteControls.jsx";
import GalleryEnhancements from "./GalleryEnhancements.jsx";
import BottomCollectionNav from "./BottomCollectionNav.jsx";
import { PROCESS_DEFINITIONS } from "./gallery-model.mjs";
import "./styles.css";
import "./collections.css";
import "./upload.css";
import "./process-sync.css";
import "./photo-lightbox.css";
import "./feature-controls.css";
import "./bottom-collection-nav.css";

const PROCESSES_UPDATED_EVENT = "memories:processes-updated";
const PHOTO_DELETED_EVENT = "memories:photo-deleted";

function applyServerProcesses(processes) {
  const normalized = Array.isArray(processes)
    ? processes
        .map((process) => ({
          id: process.id,
          zh: process.labelZh,
          en: process.labelEn || process.labelZh,
          displayOrder: Number(process.displayOrder) || 0,
        }))
        .filter((process) => process.id && process.zh)
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder ||
            left.id.localeCompare(right.id),
        )
    : [];
  PROCESS_DEFINITIONS.splice(0, PROCESS_DEFINITIONS.length, ...normalized);
}

async function hydrateProcessesFromServer() {
  try {
    const response = await fetch("/Memories/api/processes", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    const body = await response.json();
    if (!Array.isArray(body.processes)) return false;
    applyServerProcesses(body.processes);
    return true;
  } catch {
    return false;
  }
}

function MemoriesRoot() {
  const [processRevision, setProcessRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void hydrateProcessesFromServer().then((changed) => {
      if (!cancelled && changed) setProcessRevision((value) => value + 1);
    });

    const onProcessesUpdated = (event) => {
      applyServerProcesses(event.detail?.processes);
      setProcessRevision((value) => value + 1);
    };
    const onPhotoDeleted = () => {
      setProcessRevision((value) => value + 1);
    };
    window.addEventListener(PROCESSES_UPDATED_EVENT, onProcessesUpdated);
    window.addEventListener(PHOTO_DELETED_EVENT, onPhotoDeleted);
    return () => {
      cancelled = true;
      window.removeEventListener(PROCESSES_UPDATED_EVENT, onProcessesUpdated);
      window.removeEventListener(PHOTO_DELETED_EVENT, onPhotoDeleted);
    };
  }, []);

  return (
    <>
      <App key={processRevision} />
      <ProcessSyncAdmin />
      <ProcessCategoryDeleteControls />
      <GalleryEnhancements />
      <BottomCollectionNav />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MemoriesRoot />
  </React.StrictMode>,
);
