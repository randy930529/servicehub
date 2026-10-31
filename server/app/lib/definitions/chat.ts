/** A chat message as sent to clients. */
export type PublicMessageType = {
  _id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string | null;
  /**
   * Whether the **other** person has seen it. Derived from their read mark on
   * the conversation, not stored per message — see `models/conversation.ts`.
   * Only meaningful on your own messages; the UI shows it there.
   */
  readByPeer: boolean;
};

/** The other side of a conversation, as shown in the list and the header. */
export type ChatPeerType = {
  _id: string;
  name: string;
  avatarUrl: string | null;
};

/** A conversation as sent to clients, already resolved for one viewer. */
export type PublicConversationType = {
  _id: string;
  peer: ChatPeerType;
  lastMessage: {
    body: string;
    senderId: string;
    createdAt: string | null;
  } | null;
  /** Something new for the viewer. A dot, not a count — `helpers/chat.ts`. */
  hasUnread: boolean;
  updatedAt: string | null;
};
