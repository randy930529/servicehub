import { describe, expect, test } from "@jest/globals";

import type { ChatMessage } from "@/features/chat/domain/types";
import { markReadUpTo, upsertMessage } from "@/features/chat/lib/message-cache";

const PEER = "peer_1";
const ME = "me_1";

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    senderId: ME,
    body: "hola",
    createdAt: "2026-10-31T10:00:00.000Z",
    readByPeer: false,
    ...over,
  };
}

describe("upsertMessage", () => {
  test("puts a new message at the front, since the list is newest-first", () => {
    const existing = [message({ id: "m1" })];
    const next = upsertMessage(existing, message({ id: "m2" }));

    expect(next.map((m) => m.id)).toEqual(["m2", "m1"]);
  });

  test("does not duplicate a message that arrives twice", () => {
    // The sender gets their own message through the ack *and* the broadcast.
    // Without this the bubble would appear twice on their screen.
    const existing = [message({ id: "m1" })];
    const next = upsertMessage(existing, message({ id: "m1" }));

    expect(next).toHaveLength(1);
  });

  test("replaces the stored copy, so a later version wins", () => {
    const existing = [message({ id: "m1", readByPeer: false })];
    const next = upsertMessage(existing, message({ id: "m1", readByPeer: true }));

    expect(next[0].readByPeer).toBe(true);
  });

  test("does not mutate the array it was given", () => {
    const existing = [message({ id: "m1" })];
    upsertMessage(existing, message({ id: "m2" }));

    expect(existing).toHaveLength(1);
  });
});

describe("markReadUpTo", () => {
  const at = "2026-10-31T10:05:00.000Z";

  test("marks my earlier messages as seen", () => {
    const current = [
      message({ id: "m1", createdAt: "2026-10-31T10:00:00.000Z" }),
    ];
    const next = markReadUpTo(current, { at, peerId: PEER });

    expect(next[0].readByPeer).toBe(true);
  });

  test("leaves a message sent after the read mark alone", () => {
    // They read at 10:05; what I sent at 10:06 they have not seen.
    const current = [
      message({ id: "m1", createdAt: "2026-10-31T10:06:00.000Z" }),
    ];
    const next = markReadUpTo(current, { at, peerId: PEER });

    expect(next[0].readByPeer).toBe(false);
  });

  test("never marks the peer's own messages", () => {
    // "Visto" is about them having read mine, not the other way around.
    const current = [
      message({ id: "m1", senderId: PEER, createdAt: "2026-10-31T10:00:00.000Z" }),
    ];
    const next = markReadUpTo(current, { at, peerId: PEER });

    expect(next[0].readByPeer).toBe(false);
  });

  test("returns the same array when nothing changed", () => {
    // Identity is what stops a read receipt that changes nothing from
    // re-rendering the whole list.
    const current = [message({ id: "m1", readByPeer: true })];

    expect(markReadUpTo(current, { at, peerId: PEER })).toBe(current);
  });

  test("ignores an unparseable mark instead of marking everything seen", () => {
    const current = [message({ id: "m1" })];
    const next = markReadUpTo(current, { at: "no es una fecha", peerId: PEER });

    expect(next[0].readByPeer).toBe(false);
  });

  test("skips a message with no timestamp", () => {
    const current = [message({ id: "m1", createdAt: null })];
    const next = markReadUpTo(current, { at, peerId: PEER });

    expect(next[0].readByPeer).toBe(false);
  });
});
