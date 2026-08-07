import { useQuery } from "@tanstack/react-query";

import { getService } from "../domain/use-cases";
import { servicesKeys } from "./keys";

/**
 * Fetches a single service. Disabled without an id, which is how the form
 * screen distinguishes "editing" from "creating" without a second hook.
 */
export function useServiceQuery(id: string | undefined) {
  return useQuery({
    queryKey: servicesKeys.detail(id ?? ""),
    queryFn: () => getService(id as string),
    enabled: Boolean(id),
  });
}
