import "@/global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";

import { AnimatedSplashOverlay } from "@/shared/components/animated-icon";
import { useResolvedColorScheme } from "@/shared/hooks/use-resolved-color-scheme";
import { createQueryClient } from "@/shared/lib/query-client";

const queryClient = createQueryClient();

export default function RootLayout() {
  const scheme = useResolvedColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}