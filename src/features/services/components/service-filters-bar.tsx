import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";

import type { ServiceCategory } from "../domain/types";
import {
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_VALUES,
} from "../validation/service.schema";
import { FilterChip } from "./filter-chip";

/** Radii offered for "cerca de mí", in km. */
export const RADIUS_OPTIONS = [2, 5, 10, 25] as const;

export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

type ServiceFiltersBarProps = {
  category: ServiceCategory | null;
  onCategoryChange: (category: ServiceCategory | null) => void;
  radiusKm: RadiusOption | null;
  onRadiusChange: (radiusKm: RadiusOption | null) => void;
  /** Shown when the device wouldn't give us a position. */
  locationNotice?: string | null;
};

/**
 * Category and distance filters.
 *
 * Both are toggles rather than pickers: tapping the active chip clears it, so
 * "todas las categorías" and "cualquier distancia" need no extra control.
 */
export function ServiceFiltersBar({
  category,
  onCategoryChange,
  radiusKm,
  onRadiusChange,
  locationNotice,
}: ServiceFiltersBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <FilterChip
          label="Todas"
          selected={category === null}
          onPress={() => onCategoryChange(null)}
          testID="category-chip-all"
        />
        {SERVICE_CATEGORY_VALUES.map((value) => (
          <FilterChip
            key={value}
            label={SERVICE_CATEGORY_LABELS[value]}
            selected={category === value}
            // Tapping the active chip clears the filter.
            onPress={() => onCategoryChange(category === value ? null : value)}
            testID={`category-chip-${value}`}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
          Cerca de mí
        </ThemedText>
        {RADIUS_OPTIONS.map((option) => (
          <FilterChip
            key={option}
            label={`${option} km`}
            selected={radiusKm === option}
            onPress={() => onRadiusChange(radiusKm === option ? null : option)}
            testID={`radius-chip-${option}`}
          />
        ))}
      </ScrollView>

      {locationNotice ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID="location-notice"
        >
          {locationNotice}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  rowLabel: {
    marginRight: Spacing.one,
  },
});
