import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ProcessSyncAdmin from "./ProcessSyncAdmin.jsx";
import { PROCESS_DEFINITIONS } from "./gallery-model.mjs";
import "./styles.css";
import "./collections.css";
import "./upload.css";
import "./process-sync.css";
import "./photo-lightbox.css";
import "./feature-controls.css";

async function hydrateProcessesFromServer() {
  try {
    const response = await fetch("/Memories/api/processes", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    const body = await response.json();
    if (!Array.isArray(body.processes) || body.processes.length === 0) return false;
    PROCESS_DEFINITIONS.splice(
      0,
      PROCESS_DEFINITIONS.length,
      ...body.processes.map((process) => ({
        id: process.id,
        zh: process.labelZh,
        en: process.labelEn || process.labelZh,
      })),
    );
    return true;
  } catch {
    // The approved static process list remains a safe fallback while Drive is unavailable.
    return false;
  }
}

function MemoriesRoot() {
  const [processRevision, setProcessRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void hydrateProcessesFromServer().then((changed) => {
      if (!cancelled && changed) setProcessRevision(1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <App key={processRevision} />
      <ProcessSyncAdmin />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MemoriesRoot />
  </React.StrictMode>,
);
