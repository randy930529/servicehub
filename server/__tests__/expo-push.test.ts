import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPO_PUSH_CHUNK_SIZE,
  buildPushMessage,
  chunkPushMessages,
  collectUnregisteredTokens,
  type ExpoPushMessageType,
  type ExpoPushTicketType,
} from "../app/lib/notifications/expo-push";

function message(token: string): ExpoPushMessageType {
  return { to: token, title: "t", body: "b" };
}

describe("chunkPushMessages", () => {
  it("keeps a small batch in one request", () => {
    const chunks = chunkPushMessages([message("a"), message("b")]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].length, 2);
  });

  it("splits at Expo's hard limit of 100 per request", () => {
    const messages = Array.from({ length: 250 }, (_, i) => message(`t${i}`));
    const chunks = chunkPushMessages(messages);

    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, EXPO_PUSH_CHUNK_SIZE);
    assert.equal(chunks[1].length, EXPO_PUSH_CHUNK_SIZE);
    assert.equal(chunks[2].length, 50);
  });

  it("preserves order across chunks", () => {
    const messages = Array.from({ length: 101 }, (_, i) => message(`t${i}`));
    const chunks = chunkPushMessages(messages);

    // Order is the only thing linking a ticket back to its token.
    assert.equal(chunks[0][0].to, "t0");
    assert.equal(chunks[1][0].to, "t100");
  });

  it("returns nothing for an empty batch", () => {
    assert.deepEqual(chunkPushMessages([]), []);
  });
});

describe("collectUnregisteredTokens", () => {
  const messages = [message("dead-1"), message("alive"), message("dead-2")];

  it("pairs error tickets back to their token by position", () => {
    const tickets: ExpoPushTicketType[] = [
      {
        status: "error",
        message: "not registered",
        details: { error: "DeviceNotRegistered" },
      },
      { status: "ok", id: "ticket-1" },
      {
        status: "error",
        message: "not registered",
        details: { error: "DeviceNotRegistered" },
      },
    ];

    assert.deepEqual(collectUnregisteredTokens(messages, tickets), [
      "dead-1",
      "dead-2",
    ]);
  });

  it("ignores other errors — only a dead device gets its token dropped", () => {
    // MessageTooBig is our bug, not a gone device: deleting the token would
    // silence a perfectly good phone.
    const tickets: ExpoPushTicketType[] = [
      {
        status: "error",
        message: "too big",
        details: { error: "MessageTooBig" },
      },
      { status: "ok", id: "ticket-1" },
      { status: "error", message: "rate", details: { error: "MessageRateExceeded" } },
    ];

    assert.deepEqual(collectUnregisteredTokens(messages, tickets), []);
  });

  it("ignores an error with no details", () => {
    const tickets: ExpoPushTicketType[] = [
      { status: "error", message: "something went wrong" },
    ];
    assert.deepEqual(collectUnregisteredTokens(messages, tickets), []);
  });

  it("survives a short ticket list", () => {
    const tickets: ExpoPushTicketType[] = [{ status: "ok", id: "ticket-1" }];
    assert.deepEqual(collectUnregisteredTokens(messages, tickets), []);
  });

  it("returns nothing when everything went through", () => {
    const tickets: ExpoPushTicketType[] = [
      { status: "ok", id: "1" },
      { status: "ok", id: "2" },
      { status: "ok", id: "3" },
    ];
    assert.deepEqual(collectUnregisteredTokens(messages, tickets), []);
  });
});

describe("buildPushMessage", () => {
  const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

  it("puts the deep link inside data, where it survives FCM/APNs", () => {
    const built = buildPushMessage({
      token: TOKEN,
      title: "Hola",
      body: "Cuerpo",
      url: "/my-services",
    });

    assert.equal(built.to, TOKEN);
    assert.equal(built.title, "Hola");
    assert.deepEqual(built.data, { url: "/my-services" });
  });

  it("targets the same Android channel the app creates", () => {
    // A message aimed at a channel that doesn't exist arrives silently.
    const built = buildPushMessage({ token: TOKEN, title: "t", body: "b" });
    assert.equal(built.channelId, "default");
    assert.equal(built.sound, "default");
  });

  it("omits url when there is nowhere to go", () => {
    const built = buildPushMessage({ token: TOKEN, title: "t", body: "b" });
    assert.deepEqual(built.data, {});
  });

  it("merges extra data without letting it overwrite the url", () => {
    const built = buildPushMessage({
      token: TOKEN,
      title: "t",
      body: "b",
      url: "/my-services",
      data: { serviceId: "svc-1", url: "/edit-profile" },
    });

    assert.deepEqual(built.data, { serviceId: "svc-1", url: "/my-services" });
  });
});
