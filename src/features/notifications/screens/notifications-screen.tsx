import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";

import { useTestNotificationMutation } from "../queries/use-test-notification-mutation";
import {
  usePushStore,
  type PushRegistrationStatus,
} from "../stores/push.store";

const STATUS_LABEL: Record<PushRegistrationStatus, string> = {
  idle: "Sin configurar",
  registering: "Configurando…",
  registered: "Activas",
  denied: "Bloqueadas",
  unsupported: "No disponibles aquí",
  failed: "Con problemas",
};

/** Shortens the token so it's recognisable without wrapping over three lines. */
function shortenToken(token: string): string {
  return token.length <= 34 ? token : `${token.slice(0, 24)}…${token.slice(-6)}`;
}

/**
 * Notification settings and the manual end-to-end check.
 *
 * Deliberately shows the raw registration state — status, token, reason —
 * because push has many ways to be "not working" that look identical from the
 * outside: permission denied, no development build, token never registered, or
 * the send itself failing.
 */
export function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const status = usePushStore((state) => state.status);
  const token = usePushStore((state) => state.token);
  const reason = usePushStore((state) => state.reason);
  const register = usePushStore((state) => state.register);

  const testMutation = useTestNotificationMutation();
  const [notice, setNotice] = useState<string | null>(null);

  async function onSendTest() {
    setNotice(null);
    try {
      const result = await testMutation.mutateAsync(undefined);
      setNotice(
        result.sent > 0
          ? `Enviada a ${result.sent} de ${result.devices} dispositivo(s). Si no llega en unos segundos, revisa las credenciales de push.`
          : "El servidor aceptó la petición pero no pudo enviar a ningún dispositivo.",
      );
    } catch (error) {
      setNotice(testErrorMessage(error));
    }
  }

  const isRegistered = status === "registered";

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + Spacing.four,
        },
      ]}
    >
      <ThemedText type="subtitle">Notificaciones</ThemedText>

      <Card padding="md" testID="push-status-card">
        <View style={styles.row}>
          <ThemedText type="smallBold">Estado</ThemedText>
          <ThemedText type="small" testID="push-status-value">
            {STATUS_LABEL[status]}
          </ThemedText>
        </View>

        {reason ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.reason}
            testID="push-status-reason"
          >
            {reason}
          </ThemedText>
        ) : null}

        {token ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.reason}
            testID="push-token"
          >
            Token: {shortenToken(token)}
          </ThemedText>
        ) : null}
      </Card>

      <ThemedView style={styles.actions}>
        {status === "denied" ? (
          <Button
            label="Abrir ajustes del sistema"
            variant="outline"
            size="md"
            fullWidth
            testID="push-open-settings"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}

        {!isRegistered ? (
          <Button
            label="Volver a intentar"
            variant="secondary"
            size="md"
            fullWidth
            testID="push-retry-button"
            loading={status === "registering"}
            onPress={() => void register()}
          />
        ) : null}

        <Button
          label="Enviar notificación de prueba"
          variant="primary"
          size="lg"
          fullWidth
          testID="push-test-button"
          loading={testMutation.isPending}
          disabled={!isRegistered}
          onPress={onSendTest}
        />

        {!isRegistered ? (
          <ThemedText type="small" themeColor="textSecondary">
            Necesitas registrar este dispositivo antes de poder enviarte una
            notificación de prueba.
          </ThemedText>
        ) : null}

        {notice ? (
          <ThemedText type="small" testID="push-test-notice">
            {notice}
          </ThemedText>
        ) : null}
      </ThemedView>

      <Button
        label="Volver"
        variant="ghost"
        size="md"
        onPress={() => router.back()}
        style={styles.selfCentered}
      />
    </ScrollView>
  );
}

function testErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Tu sesión expiró. Inicia sesión de nuevo.";
    if (error.status === 409) {
      return "Este dispositivo aún no está registrado para recibir notificaciones.";
    }
  }
  return "No pudimos enviar la notificación. Inténtalo de nuevo.";
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  reason: {
    marginTop: Spacing.two,
  },
  actions: {
    gap: Spacing.three,
  },
  selfCentered: {
    alignSelf: "center",
  },
});
