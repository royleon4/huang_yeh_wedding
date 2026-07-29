import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  initialMemoriesState,
  memoriesStateReducer,
} from "./memories-state-model.mjs";

const MemoriesStateContext = createContext(null);

export function MemoriesStateProvider({ children }) {
  const [state, dispatch] = useReducer(
    memoriesStateReducer,
    initialMemoriesState,
  );
  const titleTaps = useRef([]);

  useEffect(() => {
    const controller = new AbortController();
    const request = (path) =>
      fetch(path, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }).then((response) => (response.ok ? response.json() : null));
    Promise.all([
      request("/Memories/api/processes"),
      request("/Memories/api/settings"),
    ])
      .then(([processPayload, settingsPayload]) => {
        if (processPayload?.processes) {
          dispatch({
            type: "processes",
            processes: processPayload.processes,
          });
        }
        if (settingsPayload) {
          dispatch({
            type: "album-open",
            open: settingsPayload.albumOpen !== false,
          });
          dispatch({
            type: "primary-navigation",
            visible: settingsPayload.primaryNavigationVisible === true,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const actions = useMemo(
    () => ({
      setLanguage(lang) {
        localStorage.setItem("memories-language", lang);
        dispatch({ type: "language", lang });
      },
      setServerProcesses(processes) {
        dispatch({ type: "processes", processes });
      },
      selectCollection(collection) {
        dispatch({ type: "collection", collection });
      },
      setModal(modal) {
        dispatch({ type: "modal", modal });
      },
      openUpload() {
        dispatch({ type: "modal", modal: "upload" });
      },
      setAdminOpen(open) {
        dispatch({ type: "admin-open", open });
      },
      setAdminAuthenticated(authenticated) {
        dispatch({ type: "admin-authenticated", authenticated });
      },
      setAlbumOpen(open) {
        dispatch({ type: "album-open", open });
      },
      setPrimaryNavigationVisible(visible) {
        dispatch({ type: "primary-navigation", visible });
      },
      markPhotosChanged() {
        dispatch({ type: "photos-changed" });
      },
      recordArchiveTitleTap() {
        const now = Date.now();
        titleTaps.current = [
          ...titleTaps.current.filter((time) => now - time < 3500),
          now,
        ];
        if (titleTaps.current.length < 5) return false;
        titleTaps.current = [];
        dispatch({ type: "admin-open", open: true });
        return true;
      },
    }),
    [],
  );

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return (
    <MemoriesStateContext.Provider value={value}>
      {children}
    </MemoriesStateContext.Provider>
  );
}

export function useMemoriesState() {
  const value = useContext(MemoriesStateContext);
  if (!value) {
    throw new Error("useMemoriesState requires MemoriesStateProvider");
  }
  return value;
}
