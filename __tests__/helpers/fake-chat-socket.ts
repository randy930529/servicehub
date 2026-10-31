import type {
  ChatHandlersType,
  ConnectToConversationInput,
  SendResultType,
} from "@/features/chat/lib/chat-socket";

/**
 * Stand-in for `features/chat/lib/chat-socket`, so a screen test can drive
 * what "arrives" without a server.
 *
 * It lives in its own module rather than inside a `jest.mock` factory for two
 * reasons: the factory may not reference anything from the test's scope, and
 * a fake typed against the real module's exports is a fake that cannot drift
 * away from it silently.
 *
 * Wire it up with:
 *
 *     jest.mock("@/features/chat/lib/chat-socket", () =>
 *       require("../helpers/fake-chat-socket"),
 *     );
 */

export const TYPING_TIMEOUT_MS = 4000;

type FakeStateType = {
  /** The live handlers, for the test to push events into. */
  handlers: ChatHandlersType | null;
  /** What `send` resolves with. Set it per case. */
  sendResult: SendResultType;
  /** Bodies that reached `send`. */
  sent: string[];
  markReadCalls: number;
  typing: boolean[];
};

export const fakeSocketState: FakeStateType = {
  handlers: null,
  sendResult: { ok: false, error: "no configurado" },
  sent: [],
  markReadCalls: 0,
  typing: [],
};

/** Back to a clean slate between cases. */
export function resetFakeSocket() {
  fakeSocketState.handlers = null;
  fakeSocketState.sendResult = { ok: false, error: "no configurado" };
  fakeSocketState.sent.length = 0;
  fakeSocketState.markReadCalls = 0;
  fakeSocketState.typing.length = 0;
}

export function connectToConversation({ handlers }: ConnectToConversationInput) {
  fakeSocketState.handlers = handlers;
  // The real client reports this as soon as the room join is acked.
  handlers.onStatus("online");

  return {
    async send(body: string): Promise<SendResultType> {
      fakeSocketState.sent.push(body);
      return fakeSocketState.sendResult;
    },
    setTyping(isTyping: boolean) {
      fakeSocketState.typing.push(isTyping);
    },
    markRead() {
      fakeSocketState.markReadCalls += 1;
    },
    close() {
      fakeSocketState.handlers = null;
    },
  };
}
