import { useQuery } from "@tanstack/react-query";

import { getPaymentHistory } from "../domain/use-cases";
import { paymentsKeys } from "./keys";

/** The caller's payment history. */
export function usePaymentHistoryQuery() {
  return useQuery({
    queryKey: [...paymentsKeys.all, "history"],
    queryFn: getPaymentHistory,
    // A refund can land at any moment, and a receipt showing the wrong amount
    // is worse than a spinner.
    staleTime: 0,
  });
}
