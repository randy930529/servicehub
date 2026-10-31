import type { Server as HttpServerType } from "node:http";

import { Server, type Socket } from "socket.io";

import { verifyAccessToken } from "@/app/lib/auth/tokens";
import type { PublicMessageType } from "@/app/lib/definitions";
import {
  ConversationRefSchema,
  SendMessageSchema,
  TypingSchema,
} from "@/app/lib/validation/chat";

/**
 * The realtime side of chat.
 *
 * Everything stateful about a live conversation lives here, and **persistence
 * is injected**: the gateway is handed three functions instead of importing
 * the service. That is what lets the socket behaviour — handshake auth, room
 * isolation, acks, typing relay — be tested in-process with no MongoDB
 * anywhere near it, which is the half of this feature most likely to break
 * silently.
 */

/** What the gateway needs from the database, and nothing more. */
export type ChatStoreType = {
  isMember(conversationId: string, userId: string): Promise<boolean>;
  send(input: {
    conversationId: string;
    senderId: string;
    body: string;
  }): Promise<
    | { ok: true; message: PublicMessageType }
    | { ok: false; status: number; message: string }
  >;
  markRead(
    conversationId: string,
    userId: string,
  ): Promise<
    { ok: true; at: Date } | { ok: false; status: number; message: string }
  >;
};

/** Socket.IO ack callback. Clients may omit it, so every call is guarded. */
type AckType = (response: unknown) => void;

/** One room per conversation; only members are ever allowed to join one. */
export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function ack(maybeAck: unknown, response: unknown) {
  if (typeof maybeAck === "function") (maybeAck as AckType)(response);
}

/**
 * Runs a handler without ever letting it reject.
 *
 * An async socket handler that throws becomes an unhandled rejection: the
 * client waits forever for an ack it will never get, and nothing in the logs
 * ties the two together.
 */
async function guard(
  label: string,
  maybeAck: unknown,
  handler: () => Promise<void>,
) {
  try {
    await handler();
  } catch (error) {
    console.error(`socket ${label} failed`, error);
    ack(maybeAck, { ok: false, error: "Something went wrong" });
  }
}

function userIdOf(socket: Socket): string {
  return socket.data.userId as string;
}

export function attachChatGateway(
  httpServer: HttpServerType,
  store: ChatStoreType,
): Server {
  const io = new Server(httpServer, {
    // The app is the only client, and it is not a browser: there is no Origin
    // header to allow, and the REST API next door sets no CORS headers
    // either. A web chat client would need both changed together.
    path: "/socket.io",
    // Trim the default 60s: a phone that went into a tunnel should be noticed
    // in seconds, because "is the other person still here" is visible UI.
    pingTimeout: 20000,
  });

  /**
   * The handshake is the only place identity is established.
   *
   * The same access JWT the REST API uses, passed in `auth.token` rather than
   * a query string — a query string ends up in logs and proxies. A socket
   * that fails here never reaches a handler, so no handler re-checks who the
   * user is; they only check what that user may touch.
   */
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string" || token.length === 0) {
      next(new Error("unauthorized"));
      return;
    }

    const claims = await verifyAccessToken(token);

    if (!claims) {
      next(new Error("unauthorized"));
      return;
    }

    socket.data.userId = claims.sub;
    next();
  });

  io.on("connection", (socket) => {
    /**
     * Joining is an authorization decision, so it is checked against the
     * database rather than trusted from the client. Without this, any
     * authenticated user could join any room by guessing an id and read a
     * conversation they are not in.
     */
    socket.on("conversation:join", (payload, maybeAck) =>
      guard("conversation:join", maybeAck, async () => {
        const parsed = ConversationRefSchema.safeParse(payload);

        if (!parsed.success) {
          ack(maybeAck, { ok: false, error: "Invalid conversation" });
          return;
        }

        const { conversationId } = parsed.data;
        const allowed = await store.isMember(conversationId, userIdOf(socket));

        if (!allowed) {
          // Same answer as a conversation that does not exist.
          ack(maybeAck, { ok: false, error: "Conversation not found" });
          return;
        }

        await socket.join(conversationRoom(conversationId));
        ack(maybeAck, { ok: true });
      }),
    );

    socket.on("conversation:leave", (payload) =>
      guard("conversation:leave", undefined, async () => {
        const parsed = ConversationRefSchema.safeParse(payload);
        if (!parsed.success) return;
        await socket.leave(conversationRoom(parsed.data.conversationId));
      }),
    );

    /**
     * Send. Validated, persisted, then broadcast — in that order, because a
     * message the other person saw and the database never stored is the one
     * failure mode nobody can explain afterwards.
     *
     * Membership is re-checked by the store (`send` loads the conversation
     * scoped to the sender), so having joined a room is not what authorizes
     * writing to it.
     */
    socket.on("message:send", (payload, maybeAck) =>
      guard("message:send", maybeAck, async () => {
        const parsed = SendMessageSchema.safeParse(payload);

        if (!parsed.success) {
          ack(maybeAck, {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Invalid message",
          });
          return;
        }

        const result = await store.send({
          conversationId: parsed.data.conversationId,
          senderId: userIdOf(socket),
          body: parsed.data.body,
        });

        if (!result.ok) {
          ack(maybeAck, { ok: false, error: result.message });
          return;
        }

        // To the whole room, the sender included: their other devices are in
        // it too. The client deduplicates by `_id` — which it has to do
        // regardless, since a reconnect refetches history that overlaps
        // whatever arrived live.
        io.to(conversationRoom(parsed.data.conversationId)).emit(
          "message:new",
          { message: result.message },
        );

        ack(maybeAck, { ok: true, message: result.message });
      }),
    );

    /**
     * Typing. Never persisted and never acked: it is worthless a second later,
     * and `socket.to(...)` excludes the sender, who does not need to be told
     * they are typing.
     */
    socket.on("typing", (payload) =>
      guard("typing", undefined, async () => {
        const parsed = TypingSchema.safeParse(payload);
        if (!parsed.success) return;

        const { conversationId, isTyping } = parsed.data;

        // No membership query: this reaches only a room, and the only way
        // into a room is the checked join above.
        socket.to(conversationRoom(conversationId)).emit("typing", {
          conversationId,
          userId: userIdOf(socket),
          isTyping,
        });
      }),
    );

    /** Read receipt: move my mark, then tell the other side to show "visto". */
    socket.on("message:read", (payload, maybeAck) =>
      guard("message:read", maybeAck, async () => {
        const parsed = ConversationRefSchema.safeParse(payload);

        if (!parsed.success) {
          ack(maybeAck, { ok: false, error: "Invalid conversation" });
          return;
        }

        const { conversationId } = parsed.data;
        const result = await store.markRead(conversationId, userIdOf(socket));

        if (!result.ok) {
          ack(maybeAck, { ok: false, error: result.message });
          return;
        }

        socket.to(conversationRoom(conversationId)).emit("message:read", {
          conversationId,
          userId: userIdOf(socket),
          at: result.at.toISOString(),
        });

        ack(maybeAck, { ok: true });
      }),
    );
  });

  return io;
}
