import { useQuery } from "@tanstack/react-query";

import { getMessages } from "../domain/use-cases";
import { chatKeys } from "./keys";

/**
 * A conversation's history, newest first.
 *
 * The socket writes into this same cache entry as messages arrive, so the
 * query is the initial load and the live feed is an update to it — not a
 * second list the screen has to merge.
 */
export function useMessagesQuery(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: () => getMessages(conversationId),
    enabled: conversationId.length > 0,
    staleTime: 0,
  });
}
