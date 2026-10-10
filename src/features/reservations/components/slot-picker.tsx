import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

import {
  formatDayLabel,
  formatSlotLabel,
  groupSlotsByDay,
  isSameDay,
} from "../lib/booking-slots";
import { useAvailabilityQuery } from "../queries/use-availability-query";

export type SlotPickerProps = {
  serviceId: string;
  selected: Date | null;
  onSelect: (slot: Date) => void;
};

/**
 * Day strip plus hour grid, driven by the service's real availability.
 *
 * The app used to generate 09:00–18:00 locally, which offered hours the
 * provider does not work and hours somebody else had already booked — the
 * mistake only surfaced after submitting. Now the server is the only thing
 * that decides what is free.
 */
export function SlotPicker({ serviceId, selected, onSelect }: SlotPickerProps) {
  const theme = useTheme();
  const { data, isPending, isError, refetch } = useAvailabilityQuery(serviceId);

  const days = useMemo(() => groupSlotsByDay(data ?? []), [data]);
  const [dayIndex, setDayIndex] = useState(0);

  if (isPending) {
    return (
      <View style={styles.centered} testID="slot-picker-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <Pressable onPress={() => refetch()} testID="slot-picker-error">
        <ThemedText type="small" themeColor="textSecondary">
          No pudimos cargar los horarios. Toca para reintentar.
        </ThemedText>
      </Pressable>
    );
  }

  if (days.length === 0) {
    return (
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID="slot-picker-empty"
      >
        Este servicio no tiene horarios disponibles por ahora.
      </ThemedText>
    );
  }

  // A refetch can shrink the list, so the index is clamped on read rather
  // than reset in an effect — the day simply becomes the nearest one left.
  const active = days[Math.min(dayIndex, days.length - 1)];

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Día</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {days.map((group, index) => {
          const isActive = isSameDay(group.day, active.day);

          return (
            <Pressable
              key={group.day.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              testID={`slot-day-${group.day.toISOString().slice(0, 10)}`}
              onPress={() => setDayIndex(index)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive
                    ? "#3c87f7"
                    : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                type="small"
                themeColor={isActive ? "background" : "text"}
              >
                {formatDayLabel(group.day)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ThemedText type="smallBold">Hora</ThemedText>
      <View style={styles.grid}>
        {active.slots.map((slot) => {
          const isActive = selected?.getTime() === slot.getTime();

          return (
            <Pressable
              key={slot.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              testID={`slot-hour-${slot.toISOString()}`}
              onPress={() => onSelect(slot)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive
                    ? "#3c87f7"
                    : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                type="small"
                themeColor={isActive ? "background" : "text"}
              >
                {formatSlotLabel(slot)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centered: {
    paddingVertical: Spacing.three,
  },
});
