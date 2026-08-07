import { apiClient } from "@/shared/lib/api-client";

import type { Service, ServiceUpdate } from "../types";
import {
  toService,
  toServiceBody,
  type ApiServiceResponse,
} from "./api-service";

/** Partial edit of a service the user owns. */
export async function updateService(
  id: string,
  changes: ServiceUpdate,
): Promise<Service> {
  const { data } = await apiClient.patch<ApiServiceResponse>(
    `/api/services/${id}`,
    toServiceBody(changes),
  );
  return toService(data.service);
}
