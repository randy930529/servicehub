import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from "@/shared/constants/theme";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { ApiError } from "@/shared/lib/api-error";
import {
  getCurrentCoordinates,
  type Coordinates,
} from "@/shared/lib/device-location";

import { SearchBar } from "../components/search-bar";
import { ServiceCard } from "../components/service-card";
import { ServicesMap } from "../components/services-map";
import { ViewModeToggle, type ViewMode } from "../components/view-mode-toggle";
import {
  ServiceFiltersBar,
  type RadiusOption,
} from "../components/service-filters-bar";
import type { ServiceCategory, ServiceFilters } from "../domain/types";
import { useServicesQuery } from "../queries/use-services-query";

function errorHint(error: unknown): string {
  if (error instanceof ApiError && error.kind === "network") {
    return "Revisa tu conexión e inténtalo de nuevo.";
  }
  return "Estamos teniendo problemas con el servidor. Inténtalo más tarde.";
}

export function CatalogScreen() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [radiusKm, setRadiusKm] = useState<RadiusOption | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // Shared by both views on purpose: one selection, two renderings of it. That
  // is what "synced" means here — not two states kept in step by hand.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // One request per pause in typing instead of one per keystroke.
  const debouncedSearch = useDebouncedValue(search);

  // The radius filter is useless without a position, so asking for the device
  // location is driven by the chip rather than done on mount — no permission
  // prompt for someone who never uses the filter.
  useEffect(() => {
    if (radiusKm === null || coordinates !== null) return;

    let active = true;
    void getCurrentCoordinates().then((result) => {
      if (!active) return;

      if (result.status === "granted") {
        setCoordinates(result.coordinates);
        setLocationNotice(null);
        return;
      }

      // Drop the chip back to "off" so the list isn't silently unfiltered
      // while the UI claims a radius is applied.
      setRadiusKm(null);
      setLocationNotice(
        result.status === "denied"
          ? "Necesitamos tu ubicación para filtrar por distancia."
          : "No pudimos obtener tu ubicación. Inténtalo de nuevo.",
      );
    });

    return () => {
      active = false;
    };
  }, [radiusKm, coordinates]);

  const filters = useMemo<ServiceFilters>(
    () => ({
      q: debouncedSearch,
      category,
      near:
        radiusKm !== null && coordinates !== null
          ? { ...coordinates, radiusKm }
          : null,
      // Nearest-first only makes sense once there is a centre to measure from.
      // With a search term the API keeps the text ranking instead; asking for
      // both is not an error, it just prefers the more useful one.
      sort: radiusKm !== null && coordinates !== null ? "distance" : undefined,
    }),
    [debouncedSearch, category, radiusKm, coordinates],
  );

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useServicesQuery(filters);

  // Resolved from the shared id rather than stored as an object: the list
  // refetches, and a held copy would quietly go stale after a price edit.
  const selectedService =
    data?.items.find((service) => service.id === selectedId) ?? null;

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 || category !== null || radiusKm !== null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Servicios
          </ThemedText>
          <Button
            label="Publicar"
            variant="primary"
            size="sm"
            testID="catalog-create-button"
            onPress={() => router.push("/service-form")}
          />
        </View>

        <View style={styles.controls}>
          <SearchBar value={search} onChangeText={setSearch} />
          <ServiceFiltersBar
            category={category}
            onCategoryChange={setCategory}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            locationNotice={locationNotice}
          />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </View>

        {isPending ? (
          <View style={styles.centered} testID="catalog-loading">
            <ActivityIndicator size="large" color="#3c87f7" />
            <ThemedText type="small" themeColor="textSecondary">
              Cargando servicios…
            </ThemedText>
          </View>
        ) : isError ? (
          <View style={styles.centered} testID="catalog-error">
            <ThemedText type="smallBold">
              No pudimos cargar los servicios
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.errorHint}
            >
              {errorHint(error)}
            </ThemedText>
            <Button
              label="Reintentar"
              testID="catalog-retry-button"
              variant="primary"
              size="md"
              loading={isFetching}
              onPress={() => refetch()}
            />
          </View>
        ) : data.items.length === 0 ? (
          <View style={styles.centered} testID="catalog-empty">
            <ThemedText type="smallBold">
              {hasActiveFilters
                ? "Sin resultados"
                : "Sin servicios disponibles"}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.errorHint}
            >
              {hasActiveFilters
                ? "Prueba con otra búsqueda o quita algún filtro."
                : "Vuelve más tarde."}
            </ThemedText>
          </View>
        ) : viewMode === "map" ? (
          <View style={styles.mapArea}>
            <ServicesMap
              services={data.items}
              center={coordinates}
              radiusKm={radiusKm}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selectedService ? (
              <View style={styles.selectedCard} testID="catalog-map-selection">
                <ServiceCard service={selectedService} />
              </View>
            ) : (
              <View style={styles.mapHint} pointerEvents="none">
                <ThemedText type="small" themeColor="textSecondary">
                  Toca un marcador para ver el servicio
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <FlatList
            testID="catalog-list"
            data={data.items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ServiceCard service={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching && !isFetchingNextPage}
            onRefresh={refetch}
            // Pull the next page in before the user hits the bottom.
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footer} testID="catalog-loading-more">
                  <ActivityIndicator />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
  },
  controls: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  errorHint: {
    textAlign: "center",
    marginBottom: Spacing.two,
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  footer: {
    paddingVertical: Spacing.three,
  },
  mapArea: {
    // No bottom margin: the map fills the area and the floating pieces below
    // clear the tab bar themselves. Shrinking the map instead left a dead white
    // strip above the tabs.
    flex: 1,
    borderRadius: Spacing.two,
    overflow: "hidden",
  },
  selectedCard: {
    position: "absolute",
    left: Spacing.two,
    right: Spacing.two,
    bottom: BottomTabInset + Spacing.two,
  },
  mapHint: {
    position: "absolute",
    alignSelf: "center",
    bottom: BottomTabInset + Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
