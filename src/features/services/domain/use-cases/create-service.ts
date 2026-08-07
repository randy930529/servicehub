import { apiClient } from "@/shared/lib/api-client";

import type { Service, ServiceInput } from "../types";
import {
  toService,
  toServiceBody,
  type ApiServiceResponse,
} from "./api-service";

/** Publishes a new service owned by the authenticated user. */
export async function createService(input: ServiceInput): Promise<Service> {
  const { data } = await apiClient.post<ApiServiceResponse>(
    "/api/services",
    toServiceBody(input),
  );
  return toService(data.service);
}
