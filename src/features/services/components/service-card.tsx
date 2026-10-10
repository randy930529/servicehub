import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Card } from "@/shared/components/ui/card";
import { Spacing } from "@/shared/constants/theme";
import { formatPriceMXN } from "@/shared/lib/format-price";
import type { Service } from "../domain/types";

/**
 * Formats a distance the way people say it: metres below a kilometre, one
 * decimal up to 10 km, whole kilometres beyond. "0.4 km" and "1.8 km" read as
 * precision the GPS does not actually have.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

type ServiceCardProps = {
  service: Service;
  /** Makes the whole card tappable (catalog detail, edit screen…). */
  onPress?: () => void;
  /** Rendered under the description — used by "mis servicios" for actions. */
  footer?: React.ReactNode;
};

export function ServiceCard({ service, onPress, footer }: ServiceCardProps) {
  const content = (
    <Card padding="none" testID={`service-card-${service.id}`}>
      {service.imageUrl ? (
        <Image
          // 4:3, the ratio the picker crops to, so the banner never letterboxes.
          style={styles.image}
          source={{ uri: service.imageUrl }}
          contentFit="cover"
          transition={150}
          testID={`service-card-image-${service.id}`}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.row}>
          <ThemedText type="smallBold" style={styles.name}>
            {service.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {service.reviewCount > 0
              ? `★ ${service.ratingAverage.toFixed(1)} (${service.reviewCount})`
              : "Sin reseñas"}
          </ThemedText>
        </View>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.desc}
          numberOfLines={3}
        >
          {service.description}
        </ThemedText>

        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            {service.providerName}
            {service.distanceKm !== undefined
              ? ` · a ${formatDistance(service.distanceKm)}`
              : ""}
          </ThemedText>
          <ThemedText type="smallBold">
            Desde {formatPriceMXN(service.priceFromCents)}
          </ThemedText>
        </View>

        {footer}
      </View>
    </Card>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`service-card-press-${service.id}`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  body: {
    padding: Spacing.three,
  },
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
