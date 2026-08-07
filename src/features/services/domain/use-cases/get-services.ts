import { apiClient } from "@/shared/lib/api-client";

import type { ServiceFilters, ServicePage } from "../types";
import {
  toService,
  toServiceQueryParams,
  type ApiServicePage,
} from "./api-service";

/** Page size for the catalog. Small enough to render fast, big enough to fill a screen. */
export const SERVICES_PAGE_SIZE = 20;

/**
 * Fetches one page of the catalog, applying the active search and filters.
 *
 * Returns the page rather than a bare array so the caller knows whether to ask
 * for more — the catalog pages as you scroll instead of pulling everything.
 */
export async function getServices(
  filters: ServiceFilters = {},
  page = 1,
): Promise<ServicePage> {
  const { data } = await apiClient.get<ApiServicePage>("/api/services", {
    params: toServiceQueryParams(filters, page, SERVICES_PAGE_SIZE),
  });

  return {
    items: data.data.map(toService),
    page: data.meta.page,
    hasNextPage: data.meta.hasNextPage,
    total: data.meta.total,
  };
}
