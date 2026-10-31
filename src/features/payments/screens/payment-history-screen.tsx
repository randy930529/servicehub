import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";
import { formatPriceMXN } from "@/shared/lib/format-price";

import type { Payment } from "../domain/types";
import { usePaymentHistoryQuery } from "../queries/use-payment-history-query";

const STATUS_LABEL: Record<Payment["status"], string> = {
  requires_payment: "Pendiente",
  processing: "Procesando",
  succeeded: "Pagado",
  failed: "Fallido",
  canceled: "Cancelado",
};

function errorHint(error: unknown): string {
  if (error instanceof ApiError && error.kind === "network") {
    return "Revisa tu conexión e inténtalo de nuevo.";
  }
  return "Estamos teniendo problemas con el servidor. Inténtalo más tarde.";
}

function Receipt({ payment }: { payment: Payment }) {
  const refunded = payment.refundState !== "none";

  return (
    <Card testID={`payment-card-${payment.id}`}>
      <View style={styles.row}>
        <ThemedText type="smallBold">
          {formatPriceMXN(payment.amountCents)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {STATUS_LABEL[payment.status]}
        </ThemedText>
      </View>

      {refunded ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID={`payment-refund-${payment.id}`}
        >
          {payment.refundState === "full"
            ? "Reembolsado por completo"
            : `Reembolsado ${formatPriceMXN(payment.refundedCents)} de ${formatPriceMXN(payment.amountCents)}`}
        </ThemedText>
      ) : null}

      {payment.lastError ? (
        <ThemedText type="small" themeColor="textSecondary">
          {/* Stripe's own words — more useful than anything we'd invent. */}
          {payment.lastError}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {payment.createdAt
          ? new Date(payment.createdAt).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : ""}
      </ThemedText>
    </Card>
  );
}

/** Receipts: what was charged, what came back, and what state it is in. */
export function PaymentHistoryScreen() {
  const { data, isPending, isError, error, refetch, isFetching } =
    usePaymentHistoryQuery();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Mis pagos
        </ThemedText>

        {isPending ? (
          <View style={styles.centered} testID="payments-loading">
            <ActivityIndicator size="large" color="#3c87f7" />
          </View>
        ) : isError ? (
          <View style={styles.centered} testID="payments-error">
            <ThemedText type="smallBold">No pudimos cargar tus pagos</ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.centeredText}
            >
              {errorHint(error)}
            </ThemedText>
            <Button
              label="Reintentar"
              variant="primary"
              size="md"
              loading={isFetching}
              testID="payments-retry-button"
              onPress={() => refetch()}
            />
          </View>
        ) : (
          <FlatList
            testID="payments-list"
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <Receipt payment={item} />}
            // Inside the list, not instead of it: rendered as a sibling the
            // empty state looks identical and leaves no way to refresh — and
            // a refund lands here without the app ever being touched.
            ListEmptyComponent={
              <View style={styles.centered} testID="payments-empty">
                <ThemedText type="smallBold">Todavía no tienes pagos</ThemedText>
              </View>
            }
            contentContainerStyle={[
              styles.listContent,
              // An empty list is zero-height, and a pull on empty space is
              // not a pull on the list.
              data.length === 0 && styles.listContentEmpty,
            ]}
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
  container: { flex: 1 },
  safeArea: {
    alignSelf: "center",
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
  title: { fontSize: 34, fontWeight: "700", paddingVertical: Spacing.three },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.two,
    justifyContent: "center",
  },
  centeredText: { marginBottom: Spacing.two, textAlign: "center" },
  listContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listContentEmpty: { flexGrow: 1 },
});
