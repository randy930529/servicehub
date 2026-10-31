import { io, type Socket } from "socket.io-client";

import { getApiBaseUrl } from "@/shared/lib/api-config";

import type { ChatConnectionStatus, ChatMessage } from "../domain/types";
import { toChatMessage, type ApiChatMessage } from "../domain/use-cases";

/**
 * Socket.IO, behind one function.
 *
 * Everything realtime and stateful lives here: the screens and the domain
 * never import `socket.io-client`, so they stay renderable in jest without a
 * server, and replacing the transport later means rewriting this file and
 * nothing else. Same arrangement as `features/payments/lib/stripe-checkout.ts`.
 */

/** How long a "typing" signal is believed without a refresh. */
export const TYPING_TIMEOUT_MS = 4000;

export type SendResultType =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: string };

export type ChatHandlersType = {
  onMessage(message: ChatMessage): void;
  onTyping(event: { userId: string; isTyping: boolean }): void;
  /** The other side read up to `at` (ISO 8601). */
  onRead(event: { userId: string; at: string }): void;
  onStatus(status: ChatConnectionStatus): void;
};

export type ChatConnectionType = {
  send(body: string): Promise<SendResultType>;
  setTyping(isTyping: boolean): void;
  markRead(): void;
  close(): void;
};

export type ConnectToConversationInput = {
  conversationId: string;
  /**
   * Read at connect time, not passed as a value.
   *
   * Access tokens live ~15 minutes and rotate; a socket that reconnects an
   * hour later has to present the *current* one. Socket.IO calls this on
   * every reconnection attempt, so the handshake never carries a token that
   * expired while the phone was asleep.
   */
  getToken: () => string | null;
  handlers: ChatHandlersType;
};

/** Timeout on a send ack. Long enough for a slow network, short enough to retry. */
const ACK_TIMEOUT_MS = 10000;

/**
 * Opens a live connection to one conversation.
 *
 * Joins the room on every (re)connect: Socket.IO reconnects transparently but
 * rooms are per-connection server state, so a silent reconnect without a
 * re-join leaves a socket that looks online and receives nothing.
 */
export function connectToConversation({
  conversationId,
  getToken,
  handlers,
}: ConnectToConversationInput): ChatConnectionType {
  const socket: Socket = io(getApiBaseUrl(), {
    // React Native has no reliable XHR streaming, and the polling handshake
    // only adds a round trip we then abandon.
    transports: ["websocket"],
    auth: (cb) => cb({ token: getToken() }),
    // The screen is short-lived; a connection that cannot be made should
    // surface as "offline" rather than retry invisibly forever.
    reconnectionAttempts: 5,
  });

  handlers.onStatus("connecting");

  socket.on("connect", () => {
    socket.emit(
      "conversation:join",
      { conversationId },
      (response: { ok?: boolean }) => {
        if (response?.ok) {
          handlers.onStatus("online");
          // Opening the conversation is reading it.
          socket.emit("message:read", { conversationId });
          return;
        }
        // Authenticated but not allowed in, or the thread is gone.
        handlers.onStatus("offline");
      },
    );
  });

  socket.on("disconnect", () => handlers.onStatus("offline"));
  socket.on("connect_error", () => handlers.onStatus("offline"));

  socket.on("message:new", (payload: { message: ApiChatMessage }) => {
    if (!payload?.message) return;
    handlers.onMessage(toChatMessage(payload.message));
  });

  socket.on(
    "typing",
    (payload: { userId: string; isTyping: boolean }) =>
      payload && handlers.onTyping(payload),
  );

  socket.on(
    "message:read",
    (payload: { userId: string; at: string }) =>
      payload && handlers.onRead(payload),
  );

  return {
    /**
     * Sends a message and resolves with what happened.
     *
     * Never rejects: an unhandled rejection inside an `onPress` is invisible,
     * and "did it send?" is the one question the UI has to be able to answer.
     * The ack is the server saying it **persisted** the message, not that it
     * received the packet.
     */
    send(body) {
      return new Promise<SendResultType>((resolve) => {
        if (!socket.connected) {
          resolve({ ok: false, error: "Sin conexión. Inténtalo de nuevo." });
          return;
        }

        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          // Unknown rather than failed: the server may have stored it and
          // lost the ack. The refetch on reconnect is what resolves it.
          resolve({ ok: false, error: "No pudimos confirmar el envío." });
        }, ACK_TIMEOUT_MS);

        socket.emit(
          "message:send",
          { conversationId, body },
          (response: { ok?: boolean; message?: ApiChatMessage; error?: string }) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            if (response?.ok && response.message) {
              resolve({ ok: true, message: toChatMessage(response.message) });
              return;
            }

            resolve({
              ok: false,
              error: response?.error ?? "No pudimos enviar el mensaje.",
            });
          },
        );
      });
    },

    setTyping(isTyping) {
      // Fire and forget: a typing signal that arrives late is worse than one
      // that never arrives.
      if (socket.connected) {
        socket.emit("typing", { conversationId, isTyping });
      }
    },

    markRead() {
      if (socket.connected) socket.emit("message:read", { conversationId });
    },

    close() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
