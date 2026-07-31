import { useEffect } from "react";
import "./admin-unified-layout.css";

const CARD_SELECTOR = [
  ".general-setting-card",
  ".website-copy-settings",
  ".admin-feature-settings",
  ".selector-settings",
  ".admin-refresh-management",
  ".admin-create-card",
  ".admin-editor-card",
].join(",");

function visible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function measureReference(reference) {
  if (visible(reference)) return reference.getBoundingClientRect().height;

  const clone = reference.cloneNode(true);
  const contentWidth =
    document.querySelector(".admin-content")?.getBoundingClientRect().width ||
    Math.min(window.innerWidth - 32, 1248);
  clone.removeAttribute("hidden");
  clone.classList.remove("admin-auto-collapsed", "admin-auto-collapsible");
  Object.assign(clone.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${Math.max(contentWidth, 320)}px`,
    maxHeight: "none",
    overflow: "visible",
    visibility: "hidden",
    pointerEvents: "none",
    display: "grid",
  });
  document.body.append(clone);
  const height = clone.getBoundingClientRect().height;
  clone.remove();
  return height;
}

function updateButton(button, collapsed) {
  const label = collapsed ? "展開編輯" : "收合卡片";
  if (button.textContent !== label) button.textContent = label;
  const expanded = String(!collapsed);
  if (button.getAttribute("aria-expanded") !== expanded) {
    button.setAttribute("aria-expanded", expanded);
  }
}

export default function AdminAutoCollapseManager() {
  useEffect(() => {
    const expandedByUser = new WeakSet();
    const observed = new Set();
    let frame = 0;

    const removeToggle = (card) => {
      card.querySelector(":scope > .admin-auto-collapse-toggle")?.remove();
      card.classList.remove("admin-auto-collapsible", "admin-auto-collapsed");
      card.style.removeProperty("--admin-card-collapse-height");
    };

    const ensureToggle = (card) => {
      let button = card.querySelector(":scope > .admin-auto-collapse-toggle");
      if (button) return button;
      button = document.createElement("button");
      button.type = "button";
      button.className = "admin-auto-collapse-toggle";
      button.addEventListener("click", () => {
        const collapsed = card.classList.toggle("admin-auto-collapsed");
        if (collapsed) expandedByUser.delete(card);
        else expandedByUser.add(card);
        updateButton(button, collapsed);
      });
      card.append(button);
      return button;
    };

    const apply = () => {
      frame = 0;
      const reference = document.getElementById("drive-upload-mode-title")?.closest(
        ".general-setting-card",
      );
      if (!reference) return;
      const referenceHeight = measureReference(reference);
      if (!Number.isFinite(referenceHeight) || referenceHeight <= 0) return;
      const collapseHeight = referenceHeight * 2;

      const cards = [...document.querySelectorAll(CARD_SELECTOR)];
      for (const card of cards) {
        if (card === reference || !visible(card)) continue;
        const tooTall = card.scrollHeight > collapseHeight + 1;
        if (!tooTall) {
          removeToggle(card);
          continue;
        }

        card.classList.add("admin-auto-collapsible");
        const heightValue = `${Math.ceil(collapseHeight)}px`;
        if (card.style.getPropertyValue("--admin-card-collapse-height") !== heightValue) {
          card.style.setProperty("--admin-card-collapse-height", heightValue);
        }
        const button = ensureToggle(card);
        const collapsed = !expandedByUser.has(card);
        card.classList.toggle("admin-auto-collapsed", collapsed);
        updateButton(button, collapsed);
      }

      if (resizeObserver) {
        for (const element of [reference, ...cards]) {
          if (observed.has(element)) continue;
          resizeObserver.observe(element);
          observed.add(element);
        }
      }
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.querySelector(".admin-shell") ?? document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", schedule);
      for (const card of document.querySelectorAll(CARD_SELECTOR)) removeToggle(card);
    };
  }, []);

  return null;
}
