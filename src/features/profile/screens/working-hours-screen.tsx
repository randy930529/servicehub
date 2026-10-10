import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

import { DEFAULT_WORKING_HOURS, type WorkingHours } from "../domain/types";
import { useProfileQuery } from "../queries/use-profile-query";
import { useUpdateProfileMutation } from "../queries/use-profile-mutations";

/** 0 = Sunday, matching the API. */
const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

/** Whole hours only — the API publishes hourly slots. */
const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? "#3c87f7" : theme.backgroundElement },
      ]}
    >
      <ThemedText type="small" themeColor={active ? "background" : "text"}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * When this provider takes bookings.
 *
 * Feeds the availability endpoint directly: whatever is set here is what
 * customers are offered, minus the hours already booked.
 */
export function WorkingHoursScreen() {
  const router = useRouter();
  const { data: profile, isPending } = useProfileQuery();
  const { mutate, isPending: isSaving, isError } = useUpdateProfileMutation();

  // Seeded from the profile once it arrives, then owned locally — the user is
  // mid-edit and a refetch must not yank their changes away.
  const [hours, setHours] = useState<WorkingHours | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (profile && profile.id !== seededFor) {
    setSeededFor(profile.id);
    setHours(profile.workingHours ?? DEFAULT_WORKING_HOURS);
  }

  if (isPending || !hours) {
    return (
      <ThemedView style={styles.centered} testID="working-hours-loading">
        <ActivityIndicator size="large" color="#3c87f7" />
      </ThemedView>
    );
  }

  const invalid = hours.endHour <= hours.startHour || hours.weekdays.length === 0;

  function toggleDay(day: number) {
    setHours((current) =>
      current
        ? {
            ...current,
            weekdays: current.weekdays.includes(day)
              ? current.weekdays.filter((d) => d !== day)
              : [...current.weekdays, day].sort((a, b) => a - b),
          }
        : current,
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Mis horarios
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Es lo que verán tus clientes al reservar, menos las horas que ya
          tengas ocupadas.
        </ThemedText>

        <ThemedText type="smallBold">Días que trabajas</ThemedText>
        <View style={styles.row}>
          {WEEKDAYS.map((day) => (
            <Chip
              key={day.value}
              label={day.label}
              active={hours.weekdays.includes(day.value)}
              testID={`working-day-${day.value}`}
              onPress={() => toggleDay(day.value)}
            />
          ))}
        </View>

        <ThemedText type="smallBold">Primera hora</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {HOURS.slice(0, 24).map((hour) => (
              <Chip
                key={hour}
                label={`${String(hour).padStart(2, "0")}:00`}
                active={hours.startHour === hour}
                testID={`working-start-${hour}`}
                onPress={() =>
                  setHours((c) => (c ? { ...c, startHour: hour } : c))
                }
              />
            ))}
          </View>
        </ScrollView>

        <ThemedText type="smallBold">Última hora</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Es la hora de cierre: con 18:00, el último hueco es a las 17:00.
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {HOURS.slice(1).map((hour) => (
              <Chip
                key={hour}
                label={`${String(hour).padStart(2, "0")}:00`}
                active={hours.endHour === hour}
                testID={`working-end-${hour}`}
                onPress={() =>
                  setHours((c) => (c ? { ...c, endHour: hour } : c))
                }
              />
            ))}
          </View>
        </ScrollView>

        {invalid ? (
          <ThemedText type="small" style={styles.error} testID="working-hours-invalid">
            {hours.weekdays.length === 0
              ? "Elige al menos un día."
              : "La hora de cierre debe ser posterior a la de apertura."}
          </ThemedText>
        ) : null}

        {isError ? (
          <ThemedText type="small" style={styles.error} testID="working-hours-error">
            No pudimos guardar tus horarios. Inténtalo más tarde.
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          label="Guardar"
          variant="primary"
          size="lg"
          fullWidth
          disabled={invalid}
          loading={isSaving}
          testID="working-hours-submit"
          onPress={() =>
            mutate(
              { workingHours: hours },
              { onSuccess: () => router.back() },
            )
          }
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    alignSelf: "center",
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    minWidth: 40,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  error: {
    color: "#d93025",
  },
  actions: {
    alignSelf: "center",
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.two,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
});
