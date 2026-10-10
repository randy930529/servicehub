import { apiClient } from "@/shared/lib/api-client";

interface ApiAvailability {
  slots: string[];
}

/**
 * Free slots for a service, soonest first.
 *
 * The app no longer invents these. It used to generate 09:00–18:00 locally,
 * which meant offering hours the provider does not work and hours somebody
 * else had already taken — the booking only failed once submitted.
 */
export async function getAvailability(serviceId: string): Promise<Date[]> {
  const { data } = await apiClient.get<ApiAvailability>(
    `/api/services/${serviceId}/availability`,
  );

  return data.slots.map((iso) => new Date(iso));
}
