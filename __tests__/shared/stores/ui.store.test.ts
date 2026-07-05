import { useUIStore } from "@/shared/stores/ui.store";
import { beforeEach, describe, expect, it } from "@jest/globals";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      themePreference: "system",
      activeModal: null,
      sessionCache: {},
    });
  });

  describe("theme", () => {
    it("defaults to system and can be changed", () => {
      expect(useUIStore.getState().themePreference).toBe("system");
      useUIStore.getState().setThemePreference("dark");
      expect(useUIStore.getState().themePreference).toBe("dark");
    });
  });

  describe("modals", () => {
    it("opens and closes a modal", () => {
      expect(useUIStore.getState().activeModal).toBeNull();

      useUIStore.getState().openModal("filters");
      expect(useUIStore.getState().activeModal).toBe("filters");

      useUIStore.getState().closeModal();
      expect(useUIStore.getState().activeModal).toBeNull();
    });
  });

  describe("session cache", () => {
    it("stores and reads typed values", () => {
      useUIStore.getState().setSessionValue("selectedCategory", "hogar");
      expect(useUIStore.getState().getSessionValue<string>("selectedCategory")).toBe(
        "hogar",
      );
    });

    it("returns undefined for missing keys", () => {
      expect(useUIStore.getState().getSessionValue("nope")).toBeUndefined();
    });

    it("clears all cached values", () => {
      useUIStore.getState().setSessionValue("a", 1);
      useUIStore.getState().clearSession();
      expect(useUIStore.getState().sessionCache).toEqual({});
    });
  });
});
