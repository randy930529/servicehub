import { useQuery } from "@tanstack/react-query";

import { getConversations } from "../domain/use-cases";
import { chatKeys } from "./keys";

/** The caller's conversations, most recently active first. */
export function useConversationsQuery() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: getConversations,
    // A message can land at any moment and this list shows the unread dot;
    // cached-but-wrong is the one state it must not sit in.
    staleTime: 0,
  });
}
