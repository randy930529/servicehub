import assert from "node:assert/strict";
import { createServer, type Server as HttpServerType } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import { io as connect, type Socket as ClientSocketType } from "socket.io-client";
import type { Server as IoServerType } from "socket.io";

import { signAccessToken } from "@/app/lib/auth/tokens";
import type { PublicMessageType } from "@/app/lib/definitions";
import {
  attachChatGateway,
  type ChatStoreType,
} from "@/app/lib/sockets/chat-gateway";

/**
 * The socket layer, end to end, over a real TCP connection: a real Socket.IO
 * server, a real client, real JWTs. Only persistence is a fake — the gateway
 * takes its store as an argument precisely so this suite needs no MongoDB.
 *
 * What is being pinned down is the part no unit test reaches: that an
 * unauthenticated socket never gets in, that a room only carries messages to
 * its own members, and that a message is stored before anyone is told about
 * it.
 */

process.env.NEXT_JWT_SECRET = "test-secret-for-unit-tests";

const ALICE = "6ade7f72e292000a0fce6d48";
const BOB = "6ade7f72e292000a0fce6d49";
const CAROL = "6ade7f72e292000a0fce6d50";
const CONVERSATION = "6ade7f72e292000a0fce6daa";
/** Alice and Bob are in this one; Carol is not. */
const MEMBERS: Record<string, string[]> = { [CONVERSATION]: [ALICE, BOB] };

type FakeStoreType = ChatStoreType & {
  /** Everything that actually reached persistence. */
  stored: { conversationId: string; senderId: string; body: string }[];
  reads: { conversationId: string; userId: string }[];
};

function makeStore(): FakeStoreType {
  const stored: FakeStoreType["stored"] = [];
  const reads: FakeStoreType["reads"] = [];

  return {
    stored,
    reads,

    async isMember(conversationId, userId) {
      return (MEMBERS[conversationId] ?? []).includes(userId);
    },

    async send({ conversationId, senderId, body }) {
      if (!(MEMBERS[conversationId] ?? []).includes(senderId)) {
        return { ok: false, status: 404, message: "Conversation not found" };
      }

      stored.push({ conversationId, senderId, body });

      const message: PublicMessageType = {
        _id: `msg_${stored.length}`,
        conversationId,
        senderId,
        body,
        createdAt: new Date("2026-10-31T10:00:00.000Z").toISOString(),
        readByPeer: false,
      };

      return { ok: true, message };
    },

    async markRead(conversationId, userId) {
      if (!(MEMBERS[conversationId] ?? []).includes(userId)) {
        return { ok: false, status: 404, message: "Conversation not found" };
      }
      reads.push({ conversationId, userId });
      return { ok: true, at: new Date("2026-10-31T10:05:00.000Z") };
    },
  };
}

let httpServer: HttpServerType;
let io: IoServerType;
let store: FakeStoreType;
let port: number;
/** Every client opened by a test, closed between cases. */
let clients: ClientSocketType[] = [];

/** Connects as `userId`, or with whatever raw token is given. */
function openSocket(options: {
  userId?: string;
  token?: string;
}): Promise<ClientSocketType> {
  return (async () => {
    const token =
      options.token ??
      (await signAccessToken({
        sub: options.userId ?? ALICE,
        email: "chat@test.com",
      }));

    const socket = connect(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    clients.push(socket);

    return new Promise<ClientSocketType>((resolve, reject) => {
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (error) => reject(error));
    });
  })();
}

/** Promise form of a socket emit with an ack. */
function emit(
  socket: ClientSocketType,
  event: string,
  payload: unknown,
): Promise<{ ok: boolean; error?: string; message?: PublicMessageType }> {
  return new Promise((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

/** Resolves on the next `event`, or rejects once `ms` has passed. */
function nextEvent(
  socket: ClientSocketType,
  event: string,
  ms = 1500,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for ${event}`)),
      ms,
    );
    socket.once(event, (payload: Record<string, unknown>) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Asserts that `event` does **not** arrive within the window. */
async function expectNoEvent(socket: ClientSocketType, event: string) {
  await assert.rejects(
    nextEvent(socket, event, 300),
    /timed out/,
    `${event} should not have arrived`,
  );
}

before(async () => {
  store = makeStore();
  httpServer = createServer();
  io = attachChatGateway(httpServer, store);

  await new Promise<void>((resolve) => {
    // Port 0: let the OS pick a free one, so the suite never collides with a
    // dev server already on 3000.
    httpServer.listen(0, () => {
      const address = httpServer.address();
      port = typeof address === "object" && address ? address.port : 0;
      resolve();
    });
  });
});

beforeEach(() => {
  store.stored.length = 0;
  store.reads.length = 0;
});

after(async () => {
  clients.forEach((socket) => socket.close());
  await io.close();
  httpServer.close();
});

describe("chat gateway: handshake", () => {
  it("refuses a connection with no token", async () => {
    await assert.rejects(openSocket({ token: "" }), /unauthorized/);
  });

  it("refuses a forged token", async () => {
    const forged = await signAccessToken({ sub: ALICE, email: "a@test.com" });
    await assert.rejects(
      openSocket({ token: `${forged.slice(0, -2)}xx` }),
      /unauthorized/,
    );
  });

  it("accepts a valid access token", async () => {
    const socket = await openSocket({ userId: ALICE });
    assert.equal(socket.connected, true);
  });
});

describe("chat gateway: joining", () => {
  it("lets a member in", async () => {
    const alice = await openSocket({ userId: ALICE });
    const result = await emit(alice, "conversation:join", {
      conversationId: CONVERSATION,
    });
    assert.equal(result.ok, true);
  });

  it("keeps a non-member out, with the same answer as a missing thread", async () => {
    // The one that matters: without this check any authenticated user could
    // guess an id and read someone else's conversation.
    const carol = await openSocket({ userId: CAROL });
    const result = await emit(carol, "conversation:join", {
      conversationId: CONVERSATION,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Conversation not found");
  });

  it("rejects a malformed id without touching the database", async () => {
    const alice = await openSocket({ userId: ALICE });
    const result = await emit(alice, "conversation:join", {
      conversationId: "not-an-id",
    });
    assert.equal(result.ok, false);
  });
});

describe("chat gateway: messages", () => {
  it("persists the message and delivers it to the other member", async () => {
    const alice = await openSocket({ userId: ALICE });
    const bob = await openSocket({ userId: BOB });

    await emit(alice, "conversation:join", { conversationId: CONVERSATION });
    await emit(bob, "conversation:join", { conversationId: CONVERSATION });

    const delivered = nextEvent(bob, "message:new");
    const ack = await emit(alice, "message:send", {
      conversationId: CONVERSATION,
      body: "¿Sigue disponible?",
    });

    assert.equal(ack.ok, true);
    assert.equal(ack.message?.body, "¿Sigue disponible?");

    // Persisted, and persisted *before* the broadcast — the ack only comes
    // back after the store call returned.
    assert.deepEqual(store.stored, [
      { conversationId: CONVERSATION, senderId: ALICE, body: "¿Sigue disponible?" },
    ]);

    const event = (await delivered) as { message: PublicMessageType };
    assert.equal(event.message.body, "¿Sigue disponible?");
    assert.equal(event.message.senderId, ALICE);
  });

  it("echoes to the sender too, so their other devices stay in sync", async () => {
    const alice = await openSocket({ userId: ALICE });
    await emit(alice, "conversation:join", { conversationId: CONVERSATION });

    const echoed = nextEvent(alice, "message:new");
    await emit(alice, "message:send", {
      conversationId: CONVERSATION,
      body: "hola",
    });

    const event = (await echoed) as { message: PublicMessageType };
    assert.equal(event.message.senderId, ALICE);
  });

  it("rejects an empty message and stores nothing", async () => {
    const alice = await openSocket({ userId: ALICE });
    await emit(alice, "conversation:join", { conversationId: CONVERSATION });

    const result = await emit(alice, "message:send", {
      conversationId: CONVERSATION,
      body: "   ",
    });

    assert.equal(result.ok, false);
    assert.equal(store.stored.length, 0);
  });

  it("rejects a message over the length limit", async () => {
    const alice = await openSocket({ userId: ALICE });
    const result = await emit(alice, "message:send", {
      conversationId: CONVERSATION,
      body: "x".repeat(2001),
    });

    assert.equal(result.ok, false);
    assert.equal(store.stored.length, 0);
  });

  it("refuses to write to a conversation the sender is not in", async () => {
    // Having joined a room is not what authorizes writing: the store checks
    // membership again on every send.
    const carol = await openSocket({ userId: CAROL });
    const result = await emit(carol, "message:send", {
      conversationId: CONVERSATION,
      body: "no debería entrar",
    });

    assert.equal(result.ok, false);
    assert.equal(store.stored.length, 0);
  });

  it("does not leak a message to a socket in another room", async () => {
    const alice = await openSocket({ userId: ALICE });
    const carol = await openSocket({ userId: CAROL });

    await emit(alice, "conversation:join", { conversationId: CONVERSATION });
    // Carol is connected and authenticated but in no room of ours.
    const leaked = expectNoEvent(carol, "message:new");

    await emit(alice, "message:send", {
      conversationId: CONVERSATION,
      body: "privado",
    });

    await leaked;
  });

  it("stops delivering after leaving the conversation", async () => {
    const alice = await openSocket({ userId: ALICE });
    const bob = await openSocket({ userId: BOB });

    await emit(alice, "conversation:join", { conversationId: CONVERSATION });
    await emit(bob, "conversation:join", { conversationId: CONVERSATION });
    bob.emit("conversation:leave", { conversationId: CONVERSATION });

    // The leave has no ack; one round-trip is enough to order it before the
    // send, since a single socket's events are processed in order.
    await emit(bob, "conversation:join", { conversationId: "not-an-id" });

    const silent = expectNoEvent(bob, "message:new");
    await emit(alice, "message:send", {
      conversationId: CONVERSATION,
      body: "ya se fue",
    });
    await silent;
  });
});

describe("chat gateway: typing", () => {
  it("reaches the other side and is never persisted", async () => {
    const alice = await openSocket({ userId: ALICE });
    const bob = await openSocket({ userId: BOB });

    await emit(alice, "conversation:join", { conversationId: CONVERSATION });
    await emit(bob, "conversation:join", { conversationId: CONVERSATION });

    const seen = nextEvent(bob, "typing");
    alice.emit("typing", { conversationId: CONVERSATION, isTyping: true });

    const event = await seen;
    assert.equal(event.userId, ALICE);
    assert.equal(event.isTyping, true);
    assert.equal(store.stored.length, 0);
  });

  it("does not echo back to whoever is typing", async () => {
    const alice = await openSocket({ userId: ALICE });
    await emit(alice, "conversation:join", { conversationId: CONVERSATION });

    const echoed = expectNoEvent(alice, "typing");
    alice.emit("typing", { conversationId: CONVERSATION, isTyping: true });
    await echoed;
  });
});

describe("chat gateway: read receipts", () => {
  it("moves the reader's mark and tells the other side", async () => {
    const alice = await openSocket({ userId: ALICE });
    const bob = await openSocket({ userId: BOB });

    await emit(alice, "conversation:join", { conversationId: CONVERSATION });
    await emit(bob, "conversation:join", { conversationId: CONVERSATION });

    const notified = nextEvent(alice, "message:read");
    const ack = await emit(bob, "message:read", {
      conversationId: CONVERSATION,
    });

    assert.equal(ack.ok, true);
    assert.deepEqual(store.reads, [
      { conversationId: CONVERSATION, userId: BOB },
    ]);

    const event = await notified;
    assert.equal(event.userId, BOB);
    assert.equal(event.conversationId, CONVERSATION);
  });

  it("refuses a read on a conversation that is not yours", async () => {
    const carol = await openSocket({ userId: CAROL });
    const result = await emit(carol, "message:read", {
      conversationId: CONVERSATION,
    });

    assert.equal(result.ok, false);
    assert.equal(store.reads.length, 0);
  });
});
