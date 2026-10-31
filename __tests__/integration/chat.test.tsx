/**
 * Integration: chat screen → queries → use-cases → axios, unmocked. MSW plays
 * the REST backend and a fake stands in for the socket.
 *
 * The socket is the one thing replaced, because what is worth pinning down
 * here is not Socket.IO (the server suite drives a real one over TCP) but what
 * this screen does with what arrives: that persisted history renders, that a
 * live message appears exactly once, and that the other side's read mark turns
 * into "Visto".
 */
import type { ReactElement } from "react";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";

import { apiUrl, server } from "../helpers/msw-server";

// The factory may not reference the test's scope, so the fake lives in its
// own module — typed against the real one, which is what keeps it honest.
jest.mock("@/features/chat/lib/chat-socket", () =>
  require("../helpers/fake-chat-socket"),
);

import { ChatScreen } from "@/features/chat/screens/chat-screen";
import { ConversationsScreen } from "@/features/chat/screens/conversations-screen";
import {
  fakeSocketState,
  resetFakeSocket,
} from "../helpers/fake-chat-socket";

const PEER_ID = "6ade7f72e292000a0fce6d49";
const CONVERSATION_ID = "6ade7f72e292000a0fce6daa";
const MESSAGES_URL = apiUrl(`/api/conversations/${CONVERSATION_ID}/messages`);

function apiConversation() {
  return {
    _id: CONVERSATION_ID,
    peer: { _id: PEER_ID, name: "Ana Pérez", avatarUrl: null },
    lastMessage: {
      body: "¿Sigue disponible?",
      senderId: PEER_ID,
      createdAt: "2026-10-31T10:00:00.000Z",
    },
    hasUnread: true,
    updatedAt: "2026-10-31T10:00:00.000Z",
  };
}

function apiMessage(over: Record<string, unknown> = {}) {
  return {
    _id: "msg_1",
    conversationId: CONVERSATION_ID,
    senderId: PEER_ID,
    body: "¿Sigue disponible?",
    createdAt: "2026-10-31T10:00:00.000Z",
    readByPeer: false,
    ...over,
  };
}

/** The happy path both suites start from: the thread opens and has history. */
function mockChatBackend(messages = [apiMessage()]) {
  server.use(
    http.post(apiUrl("/api/conversations"), () =>
      HttpResponse.json({ conversation: apiConversation() }),
    ),
    http.get(MESSAGES_URL, () =>
      HttpResponse.json({
        data: messages,
        meta: {
          page: 1,
          limit: 50,
          total: messages.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    ),
  );
}

const clients: QueryClient[] = [];

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function renderChat() {
  return renderWithClient(<ChatScreen peerId={PEER_ID} token="tok_1" />);
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  resetFakeSocket();
});
afterAll(() => server.close());

describe("ConversationsScreen", () => {
  const LIST_URL = apiUrl("/api/conversations");

  test("lists a conversation with its preview", async () => {
    server.use(http.get(LIST_URL, () =>
      HttpResponse.json({ data: [apiConversation()] }),
    ));

    const { findByText } = await renderWithClient(<ConversationsScreen />);

    expect(await findByText("Ana Pérez")).toBeTruthy();
    expect(await findByText("¿Sigue disponible?")).toBeTruthy();
  });

  test("keeps the list mounted when empty, so it can still be refreshed", async () => {
    // The regression this guards: rendering the empty state *instead of* the
    // list looks the same and silently removes pull-to-refresh — on the one
    // screen most likely to be stale, since the first message arrives while
    // you are looking at "no tienes mensajes".
    server.use(http.get(LIST_URL, () => HttpResponse.json({ data: [] })));

    const { findByTestId, getByTestId } = await renderWithClient(
      <ConversationsScreen />,
    );

    expect(await findByTestId("conversations-empty")).toBeTruthy();
    expect(getByTestId("conversations-list")).toBeTruthy();
    expect(getByTestId("conversations-list").props.onRefresh).toBeDefined();
  });
});

describe("ChatScreen: persisted history", () => {
  test("opens the conversation from the peer id and renders its messages", async () => {
    // The screen is given only who to write to; the thread is looked up (and
    // created on first contact) by the API.
    mockChatBackend();
    const { findByText, getByText } = await renderChat();

    expect(await findByText("¿Sigue disponible?")).toBeTruthy();
    // The header name comes from the loaded conversation, not from a param.
    expect(getByText("Ana Pérez")).toBeTruthy();
  });

  test("shows the empty state for a conversation with no messages", async () => {
    mockChatBackend([]);
    const { findByTestId } = await renderChat();

    expect(await findByTestId("chat-empty")).toBeTruthy();
  });

  test("surfaces a failure to open the conversation instead of spinning", async () => {
    // A disabled query still reports `isPending`, so getting this wrong
    // leaves the screen on a spinner forever.
    server.use(
      http.post(apiUrl("/api/conversations"), () =>
        HttpResponse.json({ error: "Not found" }, { status: 404 }),
      ),
    );

    const { findByTestId } = await renderChat();

    expect(await findByTestId("chat-error")).toBeTruthy();
  });
});

describe("ChatScreen: live messages", () => {
  test("renders a message that arrives over the socket", async () => {
    mockChatBackend();
    const { findByText } = await renderChat();
    await findByText("¿Sigue disponible?");

    await act(async () => {
      fakeSocketState.handlers?.onMessage(
        apiMessageAsDomain({ id: "msg_2", body: "Sí, mañana a las 10" }),
      );
    });

    expect(await findByText("Sí, mañana a las 10")).toBeTruthy();
  });

  test("does not duplicate a message that also came from the history", async () => {
    // What happens on every reconnect: the refetched page overlaps whatever
    // arrived live.
    mockChatBackend();
    const { findByText, queryAllByText } = await renderChat();
    await findByText("¿Sigue disponible?");

    await act(async () => {
      fakeSocketState.handlers?.onMessage(apiMessageAsDomain({ id: "msg_1" }));
    });

    await waitFor(() =>
      expect(queryAllByText("¿Sigue disponible?")).toHaveLength(1),
    );
  });

  test("marks the conversation read when the peer's message arrives", async () => {
    mockChatBackend();
    const { findByText } = await renderChat();
    await findByText("¿Sigue disponible?");

    await act(async () => {
      fakeSocketState.handlers?.onMessage(
        apiMessageAsDomain({ id: "msg_2", senderId: PEER_ID }),
      );
    });

    // Reading it on screen is what makes "visto" appear on the other phone.
    await waitFor(() => expect(fakeSocketState.markReadCalls).toBeGreaterThan(0));
  });
});

describe("ChatScreen: sending", () => {
  test("renders the message the server acknowledged", async () => {
    mockChatBackend();
    fakeSocketState.sendResult = {
      ok: true,
      message: {
        id: "mine_1",
        conversationId: CONVERSATION_ID,
        senderId: "me",
        body: "Sí, mañana a las 10",
        createdAt: "2026-10-31T10:01:00.000Z",
        readByPeer: false,
      },
    };

    const { findByText, getByTestId } = await renderChat();
    await findByText("¿Sigue disponible?");

    await fireEvent.changeText(
      getByTestId("chat-input"),
      "Sí, mañana a las 10",
    );
    await fireEvent.press(getByTestId("chat-send-button"));

    // The ack carries the stored message, so the bubble does not wait for the
    // broadcast to come back around.
    expect(await findByText("Sí, mañana a las 10")).toBeTruthy();
    expect(fakeSocketState.sent).toEqual(["Sí, mañana a las 10"]);
  });

  test("gives the text back when the send failed", async () => {
    // Losing what someone typed is the worst thing a chat can do with a
    // dropped connection.
    mockChatBackend();
    fakeSocketState.sendResult = { ok: false, error: "Sin conexión." };

    const { findByText, getByTestId, findByTestId } = await renderChat();
    await findByText("¿Sigue disponible?");

    await fireEvent.changeText(getByTestId("chat-input"), "¿Hola?");
    await fireEvent.press(getByTestId("chat-send-button"));

    expect(await findByTestId("chat-send-error")).toBeTruthy();
    expect(getByTestId("chat-input").props.value).toBe("¿Hola?");
  });

  test("trims the draft, so spaces alone are not a message", async () => {
    mockChatBackend();

    const { findByText, getByTestId } = await renderChat();
    await findByText("¿Sigue disponible?");

    await fireEvent.changeText(getByTestId("chat-input"), "   ");
    await fireEvent.press(getByTestId("chat-send-button"));

    expect(fakeSocketState.sent).toEqual([]);
  });
});

describe("ChatScreen: the other side's read mark", () => {
  test('turns my delivered message into "Visto"', async () => {
    mockChatBackend([
      apiMessage({
        _id: "mine_1",
        senderId: "me",
        body: "Hola, buenas tardes",
        createdAt: "2026-10-31T09:00:00.000Z",
      }),
    ]);

    const { findByText, queryByTestId, findByTestId } = await renderChat();
    await findByText("Hola, buenas tardes");

    expect(queryByTestId("message-read-mine_1")).toBeNull();

    await act(async () => {
      fakeSocketState.handlers?.onRead({
        userId: PEER_ID,
        at: "2026-10-31T09:30:00.000Z",
      });
    });

    expect(await findByTestId("message-read-mine_1")).toBeTruthy();
  });

  test("ignores a read mark older than my message", async () => {
    mockChatBackend([
      apiMessage({
        _id: "mine_1",
        senderId: "me",
        body: "Hola, buenas tardes",
        createdAt: "2026-10-31T09:00:00.000Z",
      }),
    ]);

    const { findByText, queryByTestId } = await renderChat();
    await findByText("Hola, buenas tardes");

    await act(async () => {
      fakeSocketState.handlers?.onRead({
        userId: PEER_ID,
        at: "2026-10-31T08:00:00.000Z",
      });
    });

    expect(queryByTestId("message-read-mine_1")).toBeNull();
  });
});

/** The socket hands the hook a domain message, not the API shape. */
function apiMessageAsDomain(over: Record<string, unknown> = {}) {
  return {
    id: "msg_x",
    conversationId: CONVERSATION_ID,
    senderId: PEER_ID,
    body: "¿Sigue disponible?",
    createdAt: "2026-10-31T10:00:00.000Z",
    readByPeer: false,
    ...over,
  };
}
