import React, { Component, useEffect, useState } from "react";
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
import "./bulk-photo-admin.css";

class MemoriesErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[Memories] React crash caught by ErrorBoundary:", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message ?? String(this.state.error);
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 480, margin: "4rem auto" }}>
          <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>📷 婚禮相簿暫時發生問題</p>
          <p style={{ color: "#555", marginBottom: "1rem", fontSize: "0.9rem" }}>
            The archive hit an unexpected error. Reload to try again.
          </p>
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#c00", background: "#fff0f0", padding: "0.75rem", borderRadius: 4, wordBreak: "break-all" }}>
            {msg}
          </p>
          <button
            style={{ marginTop: "1.5rem", padding: "0.5rem 1.25rem", cursor: "pointer" }}
            onClick={() => window.location.assign("/Memories/")}
          >
            重新載入
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/Memories/api/processes", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = await response.json();
    if (!Array.isArray(body.processes)) return false;
    const before = JSON.stringify(PROCESS_DEFINITIONS);
    applyServerProcesses(body.processes);
    const after = JSON.stringify(PROCESS_DEFINITIONS);
    return before !== after;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
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
    <MemoriesErrorBoundary>
      <MemoriesRoot />
    </MemoriesErrorBoundary>
  </React.StrictMode>,
);
