import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatConnectionStatus, ChatMessage } from "../domain/types";
import {
  connectToConversation,
  TYPING_TIMEOUT_MS,
  type ChatConnectionType,
  type SendResultType,
} from "../lib/chat-socket";
import { markReadUpTo, upsertMessage } from "../lib/message-cache";
import { chatKeys } from "../queries/keys";

export type UseChatConnectionInput = {
  conversationId: string;
  /**
   * The other person. Identifying "me" as *not them* avoids needing the
   * signed-in user's id, which is not in memory after a cold start — and in a
   * 1:1 conversation the two are equivalent.
   */
  peerId: string;
  /** Current access token. Changing it does **not** reconnect. */
  token: string | null;
};

export type UseChatConnectionResultType = {
  status: ChatConnectionStatus;
  isPeerTyping: boolean;
  send(body: string): Promise<SendResultType>;
  setTyping(isTyping: boolean): void;
};

/**
 * Binds one conversation's socket to the React Query cache.
 *
 * The query loads the history and the socket updates the *same* cache entry,
 * so the screen reads one list instead of merging two. Everything that
 * arrives goes through `upsertMessage`, which is what keeps the sender's own
 * message from appearing twice.
 */
export function useChatConnection({
  conversationId,
  peerId,
  token,
}: UseChatConnectionInput): UseChatConnectionResultType {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ChatConnectionStatus>("connecting");
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  const connectionRef = useRef<ChatConnectionType | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The token is read through a ref so a rotation does not tear the socket
   * down and build a new one: the connection is still valid, and only a
   * future reconnect needs the fresher token.
   */
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!conversationId) return;

    const connection = connectToConversation({
      conversationId,
      getToken: () => tokenRef.current,
      handlers: {
        onStatus: setStatus,

        onMessage: (message) => {
          queryClient.setQueryData<ChatMessage[]>(
            chatKeys.messages(conversationId),
            (current) => upsertMessage(current ?? [], message),
          );

          // The row preview and the unread dot both live on the list.
          void queryClient.invalidateQueries({
            queryKey: chatKeys.conversations(),
          });

          // The conversation is open and the message is on screen, so it has
          // been read. Telling the server here is what makes "visto" appear
          // on the other phone without a refresh.
          if (message.senderId === peerId) connection.markRead();
        },

        onTyping: ({ userId, isTyping }) => {
          // Only the other side's signal matters; my own never arrives here
          // anyway, since the server excludes the sender.
          if (userId !== peerId) return;

          setIsPeerTyping(isTyping);

          if (typingTimer.current) clearTimeout(typingTimer.current);

          // A "stopped typing" event can be lost (the app backgrounds, the
          // socket drops), and an indicator stuck on forever is worse than
          // one that expires early.
          if (isTyping) {
            typingTimer.current = setTimeout(
              () => setIsPeerTyping(false),
              TYPING_TIMEOUT_MS,
            );
          }
        },

        onRead: ({ userId, at }) => {
          if (userId !== peerId) return;

          queryClient.setQueryData<ChatMessage[]>(
            chatKeys.messages(conversationId),
            (current) => markReadUpTo(current ?? [], { at, peerId }),
          );
        },
      },
    });

    connectionRef.current = connection;

    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      connection.close();
      connectionRef.current = null;
    };
  }, [conversationId, peerId, queryClient]);

  const send = useCallback(
    async (body: string): Promise<SendResultType> => {
      const connection = connectionRef.current;

      if (!connection) {
        return { ok: false, error: "Sin conexión. Inténtalo de nuevo." };
      }

      const result = await connection.send(body);

      // The ack already carries the stored message; showing it from here
      // means the bubble appears without waiting for the broadcast.
      if (result.ok) {
        queryClient.setQueryData<ChatMessage[]>(
          chatKeys.messages(result.message.conversationId),
          (current) => upsertMessage(current ?? [], result.message),
        );
        void queryClient.invalidateQueries({
          queryKey: chatKeys.conversations(),
        });
      }

      return result;
    },
    [queryClient],
  );

  const setTyping = useCallback((isTyping: boolean) => {
    connectionRef.current?.setTyping(isTyping);
  }, []);

  return { status, isPeerTyping, send, setTyping };
}
