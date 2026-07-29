export function normalizeServerProcesses(processes) {
  return Array.isArray(processes)
    ? processes
        .map((process) => ({
          id: process.id,
          zh: process.labelZh,
          en: process.labelEn || process.labelZh,
          labelZh: process.labelZh,
          labelEn: process.labelEn || process.labelZh,
          displayOrder: Number(process.displayOrder) || 0,
        }))
        .filter((process) => process.id && process.zh)
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder ||
            left.id.localeCompare(right.id),
        )
    : [];
}

export const initialMemoriesState = {
  lang:
    typeof localStorage !== "undefined" &&
    localStorage.getItem("memories-language") === "en"
      ? "en"
      : "zh",
  processes: [],
  activeCollection: "wedding",
  modal: null,
  adminOpen: false,
  adminAuthenticated: false,
  albumOpen: true,
  primaryNavigationVisible: false,
  photoRevision: 0,
};

export function memoriesStateReducer(state, action) {
  switch (action.type) {
    case "language":
      return { ...state, lang: action.lang };
    case "processes":
      return {
        ...state,
        processes: normalizeServerProcesses(action.processes),
      };
    case "collection":
      return { ...state, activeCollection: action.collection };
    case "modal":
      return { ...state, modal: action.modal };
    case "admin-open":
      return { ...state, adminOpen: action.open };
    case "admin-authenticated":
      return { ...state, adminAuthenticated: action.authenticated };
    case "album-open":
      return { ...state, albumOpen: action.open };
    case "primary-navigation":
      return { ...state, primaryNavigationVisible: action.visible };
    case "photos-changed":
      return { ...state, photoRevision: state.photoRevision + 1 };
    default:
      return state;
  }
}
