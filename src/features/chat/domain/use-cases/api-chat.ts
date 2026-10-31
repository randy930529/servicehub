import type { ChatMessage, Conversation } from "../types";

/** A conversation as returned by the backend (Mongo `_id`). */
export interface ApiConversation {
  _id: string;
  peer: { _id: string; name: string; avatarUrl?: string | null };
  lastMessage?: {
    body: string;
    senderId: string;
    createdAt?: string | null;
  } | null;
  hasUnread?: boolean;
  updatedAt?: string | null;
}

/** A message as returned by the backend, and as the socket emits it. */
export interface ApiChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt?: string | null;
  readByPeer?: boolean;
}

export interface ApiConversationList {
  data: ApiConversation[];
}

export interface ApiConversationResponse {
  conversation: ApiConversation;
}

export interface ApiMessageList {
  data: ApiChatMessage[];
}

export function toConversation(api: ApiConversation): Conversation {
  return {
    id: api._id,
    peer: {
      id: api.peer._id,
      name: api.peer.name,
      avatarUrl: api.peer.avatarUrl ?? null,
    },
    lastMessage: api.lastMessage
      ? {
          body: api.lastMessage.body,
          senderId: api.lastMessage.senderId,
          createdAt: api.lastMessage.createdAt ?? null,
        }
      : null,
    hasUnread: api.hasUnread ?? false,
    updatedAt: api.updatedAt ?? null,
  };
}

export function toChatMessage(api: ApiChatMessage): ChatMessage {
  return {
    id: api._id,
    conversationId: api.conversationId,
    senderId: api.senderId,
    body: api.body,
    createdAt: api.createdAt ?? null,
    readByPeer: api.readByPeer ?? false,
  };
}
