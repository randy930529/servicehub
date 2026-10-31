/**
 * Query key factory for the chat feature. Centralizing keys keeps the cache
 * writes the socket performs and the invalidations the screens trigger from
 * drifting apart — a typo here is a message that arrives and never renders.
 */
export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  /** The thread with one person, by *their* id — see `use-conversation-query`. */
  conversationWith: (peerId: string) =>
    [...chatKeys.all, "with", peerId] as const,
  messages: (conversationId: string) =>
    [...chatKeys.all, "messages", conversationId] as const,
};
