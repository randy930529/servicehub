import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

/** Shared brand accent — the one hex the theme lets components hardcode. */
const ACCENT = "#3c87f7";

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** A single toggleable pill, used for category and radius filters. */
export function FilterChip({
  label,
  selected,
  onPress,
  testID,
}: FilterChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? ACCENT : theme.backgroundElement,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={selected ? styles.selectedLabel : undefined}
        themeColor={selected ? undefined : "textSecondary"}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  selectedLabel: {
    color: "#ffffff",
  },
});
