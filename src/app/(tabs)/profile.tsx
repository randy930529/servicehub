import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/features/auth";
import { ProfileScreen } from "@/features/profile";

/**
 * The app layer is the only place allowed to know about both the session and
 * the cache, which is why signing out is assembled here instead of inside the
 * profile feature.
 */
export default function ProfileRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  return (
    <ProfileScreen
      onLogout={async () => {
        await logout();
        // Server state belongs to the session that fetched it. Without this,
        // the next person to sign in on this device sees the previous one's
        // reservations, payments and conversations until every query happens
        // to refetch — which is exactly what makes switching accounts to test
        // something misleading.
        queryClient.clear();
        router.replace("/(auth)/login");
      }}
    />
  );
}
