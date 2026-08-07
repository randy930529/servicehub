import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";

import { ServiceCard } from "../components/service-card";
import type { Service } from "../domain/types";
import { useDeleteServiceMutation } from "../queries/use-service-mutations";
import { useServicesQuery } from "../queries/use-services-query";

/** The provider's own catalog: the entry point for editing and deleting. */
export function MyServicesScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch, isFetching } =
    useServicesQuery({ mineOnly: true, sort: "recent" });
  const deleteMutation = useDeleteServiceMutation();

  async function remove(service: Service) {
    setNotice(null);
    try {
      await deleteMutation.mutateAsync(service.id);
    } catch (deleteError) {
      setNotice(
        deleteError instanceof ApiError && deleteError.status === 401
          ? "Tu sesión expiró. Inicia sesión de nuevo."
          : "No pudimos eliminar el servicio. Inténtalo de nuevo.",
      );
    }
  }

  function confirmRemove(service: Service) {
    Alert.alert(
      "Eliminar servicio",
      `¿Seguro que quieres eliminar "${service.name}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void remove(service),
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Mis servicios</ThemedText>
          <Button
            label="Publicar"
            variant="primary"
            size="sm"
            testID="my-services-create-button"
            onPress={() => router.push("/service-form")}
          />
        </View>

        {notice ? (
          <ThemedText type="small" style={styles.errorText} testID="my-services-notice">
            {notice}
          </ThemedText>
        ) : null}

        {isPending ? (
          <View style={styles.centered} testID="my-services-loading">
            <ActivityIndicator />
          </View>
        ) : isError ? (
          <View style={styles.centered} testID="my-services-error">
            <ThemedText type="smallBold">
              No pudimos cargar tus servicios
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {error instanceof ApiError && error.status === 401
                ? "Tu sesión expiró. Inicia sesión de nuevo."
                : "Inténtalo de nuevo en un momento."}
            </ThemedText>
            <Button
              label="Reintentar"
              variant="primary"
              size="md"
              testID="my-services-retry-button"
              loading={isFetching}
              onPress={() => refetch()}
            />
          </View>
        ) : data.items.length === 0 ? (
          <View style={styles.centered} testID="my-services-empty">
            <ThemedText type="smallBold">Aún no publicas nada</ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.centeredText}
            >
              Publica tu primer servicio para que los clientes te encuentren.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            testID="my-services-list"
            data={data.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching}
            onRefresh={refetch}
            renderItem={({ item }) => (
              <ServiceCard
                service={item}
                footer={
                  <View style={styles.actions}>
                    <Button
                      label="Editar"
                      variant="outline"
                      size="sm"
                      testID={`edit-service-${item.id}`}
                      onPress={() =>
                        router.push(`/service-form?id=${item.id}`)
                      }
                    />
                    <Button
                      label="Eliminar"
                      variant="destructive"
                      size="sm"
                      testID={`delete-service-${item.id}`}
                      loading={
                        deleteMutation.isPending &&
                        deleteMutation.variables === item.id
                      }
                      onPress={() => confirmRemove(item)}
                    />
                  </View>
                }
              />
            )}
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: "center",
  },
  errorText: {
    // Same error red as the UI kit's TextInput.
    color: "#ef4444",
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
