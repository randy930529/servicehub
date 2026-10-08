import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

export type ViewMode = "list" | "map";

const OPTIONS: { mode: ViewMode; label: string }[] = [
  { mode: "list", label: "Lista" },
  { mode: "map", label: "Mapa" },
];

export type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

/**
 * Switches the catalog between the list and the map.
 *
 * A segmented control rather than a single toggle button: the two views are
 * peers, and a button labelled "Mapa" leaves you guessing whether it shows the
 * map or is telling you that you are already on it.
 */
export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
      // One control, one a11y role: screen readers announce the group and the
      // selected segment instead of two unrelated buttons.
      accessibilityRole="tablist"
      testID="catalog-view-toggle"
    >
      {OPTIONS.map(({ mode, label }) => {
        const active = value === mode;

        return (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Ver en ${label.toLowerCase()}`}
            testID={`catalog-view-${mode}`}
            onPress={() => onChange(mode)}
            style={[
              styles.option,
              active && { backgroundColor: theme.background },
            ]}
          >
            <ThemedText
              type={active ? "smallBold" : "small"}
              themeColor={active ? "text" : "textSecondary"}
            >
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    borderRadius: 999,
    flexDirection: "row",
    padding: 3,
  },
  option: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
