import { apiClient } from "@/shared/lib/api-client";

import type { Conversation } from "../types";
import { toConversation, type ApiConversationList } from "./api-chat";

/** The caller's conversations, most recently active first. */
export async function getConversations(): Promise<Conversation[]> {
  const { data } = await apiClient.get<ApiConversationList>(
    "/api/conversations",
  );
  return data.data.map(toConversation);
}
