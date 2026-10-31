/**
 * Chat domain models.
 *
 * Plain TypeScript shared between screens, use-cases and the data layer. No
 * React and no Socket.IO here — the socket is platform I/O and lives in
 * `lib/chat-socket.ts`, so this layer stays testable without a server.
 */

export interface ChatPeer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** The denormalized last message, which is all the list needs to render a row. */
export interface ConversationPreview {
  body: string;
  senderId: string;
  createdAt: string | null;
}

export interface Conversation {
  id: string;
  /** The other person. A conversation is always resolved for one viewer. */
  peer: ChatPeer;
  lastMessage: ConversationPreview | null;
  /**
   * Something new for me. A flag, not a count: the server derives it from the
   * last message and my read mark, and the row only shows a dot.
   */
  hasUnread: boolean;
  updatedAt: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string | null;
  /**
   * Whether the other person has seen it. Only meaningful on my own messages —
   * it comes from their single read mark on the conversation, not from a flag
   * stored per message.
   */
  readByPeer: boolean;
}

/** What the socket is doing, which the header shows. */
export type ChatConnectionStatus = "connecting" | "online" | "offline";
