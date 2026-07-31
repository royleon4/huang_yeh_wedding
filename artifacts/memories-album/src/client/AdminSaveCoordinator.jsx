import { useEffect, useRef, useSyncExternalStore } from "react";

const sections = new Map();
const listeners = new Set();

function normalizedPendingCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function pendingSnapshot() {
  let total = 0;
  for (const section of sections.values()) {
    total += normalizedPendingCount(section.getPendingCount());
  }
  return total;
}

export function useAdminSettingsPendingCount() {
  return useSyncExternalStore(subscribe, pendingSnapshot, pendingSnapshot);
}

export function useAdminSaveSection(
  id,
  { pendingCount = 0, save } = {},
) {
  const latest = useRef({ pendingCount, save });
  latest.current = { pendingCount, save };

  useEffect(() => {
    const section = {
      getPendingCount: () => normalizedPendingCount(latest.current.pendingCount),
      save: () => latest.current.save?.(),
    };
    sections.set(id, section);
    notify();
    return () => {
      if (sections.get(id) === section) sections.delete(id);
      notify();
    };
  }, [id]);

  useEffect(() => {
    notify();
  }, [pendingCount]);
}

export async function saveRegisteredAdminSettings() {
  let succeeded = 0;
  const failures = [];

  for (const [id, section] of [...sections.entries()]) {
    const pendingCount = normalizedPendingCount(section.getPendingCount());
    if (pendingCount === 0) continue;
    try {
      const result = await section.save();
      succeeded += normalizedPendingCount(result?.succeeded) || pendingCount;
    } catch (error) {
      failures.push(
        error instanceof Error && error.message
          ? error.message
          : `${id} 儲存失敗`,
      );
    }
  }

  notify();
  return { succeeded, failures };
}
