import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  conversationPairKey,
  hasUnread,
  otherMember,
} from "@/app/lib/helpers";

const ALICE = "6ade7f72e292000a0fce6d48";
const BOB = "6ade7f72e292000a0fce6d49";

describe("conversationPairKey", () => {
  it("is the same key whoever starts the conversation", () => {
    // The whole point: the unique index only enforces "one thread per pair"
    // if both directions produce the same string.
    assert.equal(
      conversationPairKey(ALICE, BOB),
      conversationPairKey(BOB, ALICE),
    );
  });

  it("is different for a different pair", () => {
    const carol = "6ade7f72e292000a0fce6d50";
    assert.notEqual(
      conversationPairKey(ALICE, BOB),
      conversationPairKey(ALICE, carol),
    );
  });

  it("separates the two ids, so no concatenation collides", () => {
    // Without a separator "ab" + "c" and "a" + "bc" would be one key.
    assert.equal(conversationPairKey("a", "bc"), "a:bc");
    assert.notEqual(conversationPairKey("a", "bc"), conversationPairKey("ab", "c"));
  });
});

describe("hasUnread", () => {
  const sentAt = new Date("2026-10-31T10:00:00.000Z");

  it("is false for an empty conversation", () => {
    assert.equal(hasUnread({ lastMessage: null, viewerId: ALICE }), false);
  });

  it("is false when the last message is my own", () => {
    // Writing it is reading it — otherwise every conversation you write in
    // immediately shows you a dot.
    assert.equal(
      hasUnread({
        lastMessage: { sender: ALICE, createdAt: sentAt },
        viewerId: ALICE,
        lastReadAt: null,
      }),
      false,
    );
  });

  it("is true when I have never opened it", () => {
    assert.equal(
      hasUnread({
        lastMessage: { sender: BOB, createdAt: sentAt },
        viewerId: ALICE,
        lastReadAt: null,
      }),
      true,
    );
  });

  it("is true when the message is newer than my read mark", () => {
    assert.equal(
      hasUnread({
        lastMessage: { sender: BOB, createdAt: sentAt },
        viewerId: ALICE,
        lastReadAt: new Date("2026-10-31T09:59:59.000Z"),
      }),
      true,
    );
  });

  it("is false once I have read past it", () => {
    assert.equal(
      hasUnread({
        lastMessage: { sender: BOB, createdAt: sentAt },
        viewerId: ALICE,
        lastReadAt: new Date("2026-10-31T10:00:01.000Z"),
      }),
      false,
    );
  });

  it("is false when the read mark lands on the message itself", () => {
    // Equal timestamps happen: marking read right after receiving. Treating
    // that as unread would leave a dot nothing can clear.
    assert.equal(
      hasUnread({
        lastMessage: { sender: BOB, createdAt: sentAt },
        viewerId: ALICE,
        lastReadAt: sentAt,
      }),
      false,
    );
  });
});

describe("otherMember", () => {
  const members = [{ user: ALICE }, { user: BOB }];

  it("finds the person on the other side", () => {
    assert.equal(otherMember(members, ALICE)?.user, BOB);
    assert.equal(otherMember(members, BOB)?.user, ALICE);
  });

  it("returns null rather than throwing on a malformed conversation", () => {
    // A one-member document should not take down the whole list.
    assert.equal(otherMember([{ user: ALICE }], ALICE), null);
  });
});
