import { useColorScheme } from "@/shared/hooks/use-color-scheme";
import { useUIStore } from "@/shared/stores/ui.store";

/**
 * Resolves the active color scheme from the user's theme preference (UI store)
 * and the OS setting. When the preference is `system`, follows the OS; otherwise
 * uses the explicit choice. Always returns a concrete `light` | `dark`.
 */
export function useResolvedColorScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();
  const preference = useUIStore((state) => state.themePreference);

  if (preference !== "system") {
    return preference;
  }
  return systemScheme === "dark" ? "dark" : "light";
}
