import { useEffect } from "react";
import { adminApi as api } from "./admin-api.mjs";

const ADMIN_SELECTOR = ".process-sync-admin";

function findActionButton(admin, text) {
  return [...admin.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
}

export default function ProcessCategoryDeleteControls() {
  useEffect(() => {
    let decorating = false;

    const decorate = async () => {
      if (decorating) return;
      const admin = document.querySelector(ADMIN_SELECTOR);
      if (!admin) return;
      const rows = [...admin.querySelectorAll("ol > li")];
      if (rows.length === 0) return;
      decorating = true;
      try {
        const response = await fetch("/Memories/api/processes", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const payload = await response.json();
        const processes = Array.isArray(payload.processes) ? payload.processes : [];
        rows.forEach((row, index) => {
          if (row.querySelector(".process-delete-button")) return;
          const process = processes[index];
          if (!process?.id) return;
          const actions = row.querySelector("div");
          if (!actions) return;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "process-delete-button";
          button.textContent = "刪除";
          button.setAttribute("aria-label", `刪除分類 ${process.labelZh}`);
          button.addEventListener("click", async () => {
            const confirmed = window.confirm(
              `確定刪除「${process.labelZh}」？只有空的分類可以刪除。`,
            );
            if (!confirmed) return;
            const token = sessionStorage.getItem("memories-admin-token") || "";
            button.disabled = true;
            try {
              await api(
                `/Memories/api/admin/processes/${encodeURIComponent(process.id)}`,
                { token, method: "DELETE" },
              );
              findActionButton(admin, "立即同步 Drive")?.click();
            } catch (error) {
              window.alert(error instanceof Error ? error.message : "刪除分類失敗");
            } finally {
              button.disabled = false;
            }
          });
          actions.append(button);
        });

        const actions = admin.querySelector(".process-sync-actions");
        if (actions && !actions.querySelector(".process-reload-button")) {
          const reload = document.createElement("button");
          reload.type = "button";
          reload.className = "process-reload-button";
          reload.textContent = "重新讀取分類";
          reload.addEventListener("click", () =>
            findActionButton(admin, "立即同步 Drive")?.click(),
          );
          actions.prepend(reload);
        }
      } finally {
        decorating = false;
      }
    };

    const observer = new MutationObserver(() => void decorate());
    observer.observe(document.body, { childList: true, subtree: true });
    void decorate();
    return () => observer.disconnect();
  }, []);

  return null;
}
