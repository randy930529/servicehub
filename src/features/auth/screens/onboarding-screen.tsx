import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";

import { Button } from "@/shared/components/ui/button";
import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

const SLIDES = [
  {
    icon: { ios: "magnifyingglass", android: "search", web: "search" } as const,
    title: "Encuentra servicios cerca",
    subtitle: "Conecta con profesionales verificados a minutos de tu ubicación.",
  },
  {
    icon: { ios: "calendar", android: "event", web: "event" } as const,
    title: "Agenda en segundos",
    subtitle: "Selecciona fecha, hora y proveedor. Sin llamadas, sin esperas.",
  },
  {
    icon: { ios: "star.fill", android: "star", web: "star" } as const,
    title: "Proveedores verificados",
    subtitle: "Reseñas reales, perfiles verificados y pago seguro en cada servicio.",
  },
] as const;

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  function handleNext() {
    if (isLast) {
      router.replace("/(auth)/login");
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Pressable
        style={styles.skipBtn}
        onPress={() => router.replace("/(auth)/login")}
      >
        <ThemedText type="small" themeColor="textSecondary">
          Saltar
        </ThemedText>
      </Pressable>

      <Animated.View key={step} entering={FadeIn.duration(300)} style={styles.slide}>
        <ThemedView type="backgroundElement" style={styles.iconContainer}>
          <SymbolView
            name={slide.icon}
            size={52}
            tintColor={theme.text}
            weight="semibold"
          />
        </ThemedView>

        <View style={styles.textBlock}>
          <ThemedText type="subtitle" style={styles.title}>
            {slide.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {slide.subtitle}
          </ThemedText>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === step ? theme.text : theme.backgroundSelected },
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Button
          label={isLast ? "Comenzar" : "Siguiente"}
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleNext}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.two,
    marginTop: Spacing.two,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.four,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: {
    gap: Spacing.two,
    alignItems: "center",
    paddingHorizontal: Spacing.two,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.one,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    borderRadius: 3,
  },
});
