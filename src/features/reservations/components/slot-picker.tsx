import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

import {
  buildBookableDays,
  buildDaySlots,
  formatDayLabel,
  formatSlotLabel,
  isSameDay,
} from "../lib/booking-slots";

export type SlotPickerProps = {
  selected: Date | null;
  onSelect: (slot: Date) => void;
};

/**
 * Day strip plus hour grid.
 *
 * A grid of real slots rather than a datetime spinner: a service offers
 * openings, not arbitrary instants, and this needs no native picker module —
 * so no extra dependency and no rebuild.
 */
export function SlotPicker({ selected, onSelect }: SlotPickerProps) {
  const theme = useTheme();

  // Pinned at mount: recomputing `new Date()` on every render would make slots
  // disappear mid-interaction as the clock crosses an hour.
  const [now] = useState(() => new Date());

  const days = useMemo(() => buildBookableDays(now), [now]);
  const [day, setDay] = useState<Date>(() => days[0]);

  const slots = useMemo(() => buildDaySlots(day, now), [day, now]);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">Día</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {days.map((candidate) => {
          const active = isSameDay(candidate, day);

          return (
            <Pressable
              key={candidate.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`slot-day-${candidate.toISOString().slice(0, 10)}`}
              onPress={() => setDay(candidate)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? "#3c87f7" : theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                type="small"
                themeColor={active ? "background" : "text"}
              >
                {formatDayLabel(candidate, now)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ThemedText type="smallBold">Hora</ThemedText>
      {slots.length === 0 ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID="slot-picker-empty"
        >
          No quedan horarios este día. Prueba con otro.
        </ThemedText>
      ) : (
        <View style={styles.grid}>
          {slots.map((slot) => {
            const active = selected?.getTime() === slot.getTime();

            return (
              <Pressable
                key={slot.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`slot-hour-${slot.toISOString()}`}
                onPress={() => onSelect(slot)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active
                      ? "#3c87f7"
                      : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  themeColor={active ? "background" : "text"}
                >
                  {formatSlotLabel(slot)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
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
});
