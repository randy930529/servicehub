import { apiClient } from "@/shared/lib/api-client";

import type { TestNotificationResult } from "../types";

/**
 * Asks the backend to push to every device this user has registered.
 *
 * The body is always sent — `{}` means "use the defaults" — because the API
 * validates JSON and a bodyless POST would be a 400.
 */
export async function sendTestNotification(options?: {
  title?: string;
  body?: string;
  url?: string;
}): Promise<TestNotificationResult> {
  const { data } = await apiClient.post<TestNotificationResult>(
    "/api/notifications/test",
    options ?? {},
  );
  return data;
}
