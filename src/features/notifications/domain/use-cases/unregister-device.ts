import { apiClient } from "@/shared/lib/api-client";

/**
 * Stops notifications for this device — what sign-out has to do, otherwise the
 * phone keeps receiving pushes meant for an account nobody is signed into.
 *
 * Resolves with whether a registration was actually removed.
 */
export async function unregisterDevice(token: string): Promise<boolean> {
  const { data } = await apiClient.delete<{ removed: boolean }>(
    "/api/users/me/devices",
    { data: { token } },
  );
  return data.removed;
}
