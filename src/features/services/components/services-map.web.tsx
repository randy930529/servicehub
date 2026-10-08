import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";

import type { ServicesMapProps } from "./services-map";

/**
 * Web stand-in for the native map.
 *
 * `react-native-maps` renders nothing on web, and importing it there pulls in
 * native modules that break the bundle. The catalog still works on web — the
 * list is the primary view — so this says what is missing instead of failing.
 *
 * Keep the prop type imported from the native file so the two signatures can
 * never drift apart.
 */
export function ServicesMap({ services }: ServicesMapProps) {
  const withLocation = services.filter((s) => s.location !== null).length;

  return (
    <View style={styles.container} testID="services-map-web-fallback">
      <ThemedText type="smallBold">El mapa solo está disponible en móvil</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {withLocation > 0
          ? `${withLocation} ${withLocation === 1 ? "servicio tiene" : "servicios tienen"} ubicación. Ábrelo en Android o iOS para verlos en el mapa.`
          : "Estos servicios no tienen ubicación registrada."}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.one,
    justifyContent: "center",
    padding: Spacing.three,
  },
  hint: {
    textAlign: "center",
  },
});
