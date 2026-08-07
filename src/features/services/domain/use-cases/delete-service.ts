import { apiClient } from "@/shared/lib/api-client";

/**
 * Deletes a service the user owns. Resolves with the id so the caller can
 * evict it from the cache without keeping the argument around.
 */
export async function deleteService(id: string): Promise<string> {
  await apiClient.delete(`/api/services/${id}`);
  return id;
}
