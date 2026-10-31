import { apiClient } from "@/shared/lib/api-client";

import type { Payment } from "../types";
import { toPayment, type ApiPaymentList } from "./api-payment";

/** Every payment the caller made, newest first. */
export async function getPaymentHistory(): Promise<Payment[]> {
  const { data } = await apiClient.get<ApiPaymentList>("/api/payments/history");
  return data.data.map(toPayment);
}
