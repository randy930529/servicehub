import { create } from "zustand";

/** User's theme choice; `system` follows the OS setting. */
export type ThemePreference = "system" | "light" | "dark";

type UIState = {
  // --- Theme ---
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;

  // --- Modals ---
  /** Id of the currently open modal, or null when none is open. */
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;

  // --- Session cache ---
  /**
   * Ephemeral, in-memory key/value store for the current app session (e.g. the
   * last selected filters). Not persisted — cleared on reload. For durable data
   * use React Query (server state) or SecureStore (auth token).
   */
  sessionCache: Record<string, unknown>;
  setSessionValue: (key: string, value: unknown) => void;
  getSessionValue: <T>(key: string) => T | undefined;
  clearSession: () => void;
};

export const useUIStore = create<UIState>((set, get) => ({
  themePreference: "system",
  setThemePreference: (themePreference) => set({ themePreference }),

  activeModal: null,
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),

  sessionCache: {},
  setSessionValue: (key, value) =>
    set((state) => ({
      sessionCache: { ...state.sessionCache, [key]: value },
    })),
  getSessionValue: <T,>(key: string) => get().sessionCache[key] as T | undefined,
  clearSession: () => set({ sessionCache: {} }),
}));
