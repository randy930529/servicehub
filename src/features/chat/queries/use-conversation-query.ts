import { useQuery } from "@tanstack/react-query";

import { openConversation } from "../domain/use-cases";
import { chatKeys } from "./keys";

/**
 * The conversation with one person, opening it if it does not exist yet.
 *
 * A query that POSTs looks odd and is deliberate: the endpoint is
 * find-or-create keyed by the pair of participants, so calling it is a read
 * with a side effect that happens at most once per pair, ever. Making this
 * the only way into a chat means both entry points — the conversation list
 * and "escribir" on a reservation — take the same path, and neither has to
 * know whether a thread already exists.
 */
export function useConversationQuery(peerId: string) {
  return useQuery({
    queryKey: chatKeys.conversationWith(peerId),
    queryFn: () => openConversation(peerId),
    enabled: peerId.length > 0,
    // The id of a pair's conversation never changes, so there is nothing to
    // refetch for the length of a session.
    staleTime: Infinity,
  });
}
