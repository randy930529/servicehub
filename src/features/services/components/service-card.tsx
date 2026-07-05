import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Card } from "@/shared/components/ui/card";
import { Spacing } from "@/shared/constants/theme";
import type { Service } from "../domain/types";

/** Formats integer cents as a grouped MXN amount, e.g. 45000 -> "$450 MXN". */
function formatPrice(cents: number): string {
  const pesos = Math.round(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${pesos} MXN`;
}

export function ServiceCard({ service }: { service: Service }) {
  return (
    <Card padding="md" testID={`service-card-${service.id}`}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.name}>
          {service.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ★ {service.rating.toFixed(1)}
        </ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
        {service.description}
      </ThemedText>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {service.providerName}
        </ThemedText>
        <ThemedText type="smallBold">
          Desde {formatPrice(service.priceFromCents)}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  desc: {
    marginVertical: Spacing.two,
  },
});
