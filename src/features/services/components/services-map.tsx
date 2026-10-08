import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";
import type { Coordinates } from "@/shared/lib/device-location";

import type { Service } from "../domain/types";

/**
 * How much of the map a radius filter should fill. A radius drawn edge-to-edge
 * leaves no context around it, so the view is opened a little wider than the
 * circle the user asked for.
 */
const REGION_PADDING = 2.5;

/** Degrees of latitude per kilometre — constant, unlike longitude. */
const DEGREES_PER_KM = 1 / 111;

/** Fallback span when there is no radius to derive one from (~5 km). */
const DEFAULT_DELTA = 0.05;

export type ServicesMapProps = {
  services: Service[];
  /** Where the user is, when known. Centres the map and drops the blue dot. */
  center: Coordinates | null;
  /** Active radius filter, used to frame the view around what was searched. */
  radiusKm: number | null;
  selectedId: string | null;
  onSelect: (serviceId: string) => void;
};

/**
 * Only services with coordinates can be pinned. Filtering here rather than at
 * the call site keeps the map the single place that knows this.
 */
function mappable(services: Service[]) {
  return services.filter(
    (service): service is Service & { location: NonNullable<Service["location"]> } =>
      service.location !== null,
  );
}

/**
 * Frames the map around the search: the user's position when there is one,
 * otherwise the first result, so an empty map never opens on the ocean.
 */
function initialRegion(
  center: Coordinates | null,
  radiusKm: number | null,
  services: Service[],
): Region | undefined {
  const anchor = center ?? mappable(services)[0]?.location ?? null;
  if (!anchor) return undefined;

  const delta = radiusKm
    ? radiusKm * DEGREES_PER_KM * REGION_PADDING
    : DEFAULT_DELTA;

  return {
    latitude: anchor.lat,
    longitude: anchor.lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/**
 * The catalog's results as map pins.
 *
 * Deliberately stateless: the selected service lives in the screen, shared with
 * the list, which is what keeps the two views in sync instead of letting each
 * hold its own idea of what is selected.
 */
export function ServicesMap({
  services,
  center,
  radiusKm,
  selectedId,
  onSelect,
}: ServicesMapProps) {
  const pins = mappable(services);
  const region = initialRegion(center, radiusKm, services);

  if (!region) {
    return (
      <View style={styles.empty} testID="services-map-empty">
        <ThemedText type="smallBold">Nada que mostrar en el mapa</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Estos servicios no tienen ubicación registrada.
        </ThemedText>
      </View>
    );
  }

  return (
    <MapView
      // Google Maps on both platforms, so a marker looks the same everywhere
      // and there is one API key to manage instead of two map SDKs.
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      testID="services-map"
      initialRegion={region}
      showsUserLocation={center !== null}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {pins.map((service) => (
        <Marker
          key={service.id}
          testID={`services-map-marker-${service.id}`}
          identifier={service.id}
          coordinate={{
            latitude: service.location.lat,
            longitude: service.location.lng,
          }}
          title={service.name}
          description={service.providerName}
          // The selected pin is tinted rather than scaled: resizing a marker
          // moves its anchor, so the pin would appear to drift on selection.
          pinColor={service.id === selectedId ? "#3c87f7" : undefined}
          onPress={() => onSelect(service.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  empty: {
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
