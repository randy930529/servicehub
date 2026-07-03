import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { TextInput } from "@/shared/components/ui/text-input";
import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { BottomTabInset, Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

export default function PlaygroundScreen() {
  const insets = useSafeAreaInsets();
  const [inputValue, setInputValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
      >
        <ThemedText type="subtitle" style={styles.pageTitle}>
          Componentes
        </ThemedText>

        {/* BUTTON — VARIANTES */}
        <Section title="BUTTON — VARIANTES">
          <Button label="Primary" variant="primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Outline" variant="outline" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Destructive" variant="destructive" />
        </Section>

        {/* BUTTON — TAMAÑOS */}
        <Section title="BUTTON — TAMAÑOS">
          <Button label="Small" variant="primary" size="sm" />
          <Button label="Medium" variant="primary" size="md" />
          <Button label="Large" variant="primary" size="lg" />
        </Section>

        {/* BUTTON — ESTADOS */}
        <Section title="BUTTON — ESTADOS">
          <Button label="Full width" variant="primary" size="md" fullWidth />
          <Button label="Loading..." variant="primary" size="md" loading />
          <Button label="Disabled" variant="primary" size="md" disabled />
        </Section>

        {/* TEXT INPUT */}
        <Section title="TEXT INPUT">
          <TextInput
            label="Sin estado"
            placeholder="Escribe algo..."
            value={inputValue}
            onChangeText={setInputValue}
          />
          <TextInput
            label="Con helper"
            placeholder="tu@correo.com"
            helper="Nunca compartiremos tu correo."
            keyboardType="email-address"
          />
          <TextInput
            label="Con error"
            placeholder="Ingresa un valor"
            error="Este campo es requerido"
            value=""
          />
          <TextInput
            label="Contraseña"
            placeholder="••••••••"
            secureTextEntry
            value={passwordValue}
            onChangeText={setPasswordValue}
          />
        </Section>

        {/* CARD */}
        <Section title="CARD">
          <Card title="Card básica" subtitle="Subtítulo opcional">
            <ThemedText type="small">Contenido del card. Puede ser cualquier componente.</ThemedText>
          </Card>

          <Card
            title="Con footer"
            subtitle="Padding medium"
            footer={
              <View style={styles.cardFooter}>
                <Button label="Cancelar" variant="ghost" size="sm" />
                <Button label="Confirmar" variant="primary" size="sm" />
              </View>
            }
          >
            <ThemedText type="small">
              Los footers sirven para acciones contextuales dentro del card.
            </ThemedText>
          </Card>

          <Card padding="lg">
            <ThemedText type="smallBold">Sin título, padding large</ThemedText>
            <ThemedText type="small">Útil para contenido destacado sin encabezado.</ThemedText>
          </Card>

          <Card padding="sm">
            <ThemedText type="small">Padding small — compacto para listas.</ThemedText>
          </Card>
        </Section>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  pageTitle: {
    marginBottom: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: Spacing.one,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
});
