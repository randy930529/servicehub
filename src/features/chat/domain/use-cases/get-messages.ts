import { apiClient } from "@/shared/lib/api-client";

import type { ChatMessage } from "../types";
import { toChatMessage, type ApiMessageList } from "./api-chat";

/**
 * How many messages the chat opens with.
 *
 * One page, not an infinite scroll: the endpoint is paginated and the screen
 * renders newest-first, so older history is a `page` away whenever it is
 * worth adding.
 */
export const MESSAGE_PAGE_SIZE = 50;

/** A conversation's history, **newest first** — the order the screen renders. */
export async function getMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ApiMessageList>(
    `/api/conversations/${conversationId}/messages`,
    { params: { limit: MESSAGE_PAGE_SIZE } },
  );
  return data.data.map(toChatMessage);
}
