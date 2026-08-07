import { apiClient } from "@/shared/lib/api-client";

import type { Service } from "../types";
import { toService, type ApiServiceResponse } from "./api-service";

/** Fetches a single service by id (used to prefill the edit form). */
export async function getService(id: string): Promise<Service> {
  const { data } = await apiClient.get<ApiServiceResponse>(
    `/api/services/${id}`,
  );
  return toService(data.service);
}
