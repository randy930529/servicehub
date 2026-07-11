import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";
import { ServiceCard } from "../components/service-card";
import { useServicesQuery } from "../queries/use-services-query";

function errorHint(error: unknown): string {
  if (error instanceof ApiError && error.kind === "network") {
    return "Revisa tu conexión e inténtalo de nuevo.";
  }
  return "Estamos teniendo problemas con el servidor. Inténtalo más tarde.";
}

export function CatalogScreen() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useServicesQuery();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Servicios
        </ThemedText>

        {isPending ? (
          <View style={styles.centered} testID="catalog-loading">
            <ActivityIndicator size="large" color="#3c87f7" />
            <ThemedText type="small" themeColor="textSecondary">
              Cargando servicios…
            </ThemedText>
          </View>
        ) : isError ? (
          <View style={styles.centered} testID="catalog-error">
            <ThemedText type="smallBold">No pudimos cargar los servicios</ThemedText>
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
        ) : data.length === 0 ? (
          <View style={styles.centered} testID="catalog-empty">
            <ThemedText type="smallBold">Sin servicios disponibles</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Vuelve más tarde.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            testID="catalog-list"
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ServiceCard service={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching}
            onRefresh={refetch}
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
  title: {
    fontSize: 34,
    fontWeight: "700",
    paddingVertical: Spacing.three,
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
});
