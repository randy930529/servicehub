import { apiClient } from "@/shared/lib/api-client";

import type { Conversation } from "../types";
import { toConversation, type ApiConversationResponse } from "./api-chat";

/**
 * Opens the thread with one person, creating it on first contact.
 *
 * Safe to call every time: the server keys a conversation by the pair of
 * participants, so this returns the existing thread rather than a second one.
 * That is why the app never needs to remember whether it already has one.
 */
export async function openConversation(peerId: string): Promise<Conversation> {
  const { data } = await apiClient.post<ApiConversationResponse>(
    "/api/conversations",
    { peerId },
  );
  return toConversation(data.conversation);
}
