import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";

export const MAX_STARS = 5;

export type StarRatingProps = {
  value: number;
  /** Omit to render read-only — the same stars serve both jobs. */
  onChange?: (rating: number) => void;
  testIDPrefix?: string;
};

/**
 * Five stars, editable or not.
 *
 * Text glyphs rather than an icon set: `expo-symbols` is mocked away in tests
 * and has no Android equivalent here, and a star is one character that renders
 * identically everywhere.
 */
export function StarRating({
  value,
  onChange,
  testIDPrefix = "star",
}: StarRatingProps) {
  const readOnly = !onChange;

  return (
    <View
      style={styles.row}
      accessibilityRole={readOnly ? "text" : "radiogroup"}
      accessibilityLabel={`${value} de ${MAX_STARS} estrellas`}
    >
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const star = index + 1;
        const filled = star <= value;

        if (readOnly) {
          return (
            <ThemedText
              key={star}
              type="small"
              themeColor={filled ? "text" : "textSecondary"}
            >
              {filled ? "★" : "☆"}
            </ThemedText>
          );
        }

        return (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityState={{ selected: star === value }}
            accessibilityLabel={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
            testID={`${testIDPrefix}-${star}`}
            onPress={() => onChange(star)}
            hitSlop={Spacing.one}
          >
            <ThemedText
              type="title"
              themeColor={filled ? "text" : "textSecondary"}
            >
              {filled ? "★" : "☆"}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.one,
  },
});
