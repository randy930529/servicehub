import "@/global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useEffect } from "react";

import { useAuthStore } from "@/features/auth";
import {
  configureNotificationHandler,
  useNotificationObserver,
  usePushRegistration,
} from "@/features/notifications";
import { AnimatedSplashOverlay } from "@/shared/components/animated-icon";
import { useResolvedColorScheme } from "@/shared/hooks/use-resolved-color-scheme";
import { createQueryClient } from "@/shared/lib/query-client";

const queryClient = createQueryClient();

// Module scope on purpose: a notification can be handled before the first
// render, and a handler installed inside an effect would arrive too late.
configureNotificationHandler();

export default function RootLayout() {
  const scheme = useResolvedColorScheme();

  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const token = useAuthStore((state) => state.token);

  // Restore the stored session on startup, so a returning user stays signed in
  // (and their device re-registers for push).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // The app layer is the only place that may know about both features: auth
  // owns the session, notifications owns the device token, and neither is
  // allowed to import the other.
  usePushRegistration(isHydrated && Boolean(token));
  useNotificationObserver();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
