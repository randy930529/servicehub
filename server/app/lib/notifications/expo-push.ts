/**
 * Client for the Expo Push Service (https://exp.host/--/api/v2/push/send).
 *
 * Expo relays to FCM and APNs, so this server never talks to Google or Apple
 * directly and needs no per-platform credentials of its own — the price is that
 * delivery problems come back as *tickets*, not as HTTP errors.
 *
 * The payload building and ticket reading are pure functions so every case can
 * be tested without a network round-trip.
 */

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Expo rejects requests carrying more than 100 messages. */
export const EXPO_PUSH_CHUNK_SIZE = 100;

/** Android channel the app creates on startup; must match `push-token.ts`. */
export const DEFAULT_ANDROID_CHANNEL_ID = "default";

export type ExpoPushMessageType = {
  to: string;
  title?: string;
  body?: string;
  /** Arbitrary payload; `url` is what the app deep-links to. */
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
};

export type ExpoPushTicketType =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoPushResultType = {
  tickets: ExpoPushTicketType[];
  /**
   * Tokens Expo says are dead. The caller must stop sending to them — Apple
   * and Google both consider it abuse to keep pushing to a gone device.
   */
  unregisteredTokens: string[];
};

/** Splits messages into request-sized batches. */
export function chunkPushMessages(
  messages: ExpoPushMessageType[],
  size: number = EXPO_PUSH_CHUNK_SIZE,
): ExpoPushMessageType[][] {
  const chunks: ExpoPushMessageType[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    chunks.push(messages.slice(i, i + size));
  }
  return chunks;
}

/**
 * Pairs tickets back to the tokens that produced them.
 *
 * Expo returns tickets *in the order the messages were sent* and gives no other
 * way to tell which token failed, so the index is the only link — which is
 * exactly why the two arrays must never be reordered between send and read.
 */
export function collectUnregisteredTokens(
  messages: ExpoPushMessageType[],
  tickets: ExpoPushTicketType[],
): string[] {
  const dead: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status !== "error") return;
    if (ticket.details?.error !== "DeviceNotRegistered") return;

    const token = messages[index]?.to;
    if (token) dead.push(token);
  });

  return dead;
}

/**
 * Builds the message for one device.
 *
 * `data.url` is what the app reads to deep-link; keeping it inside `data` (and
 * not at the top level) is what makes it survive the trip through FCM/APNs.
 */
export function buildPushMessage(input: {
  token: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}): ExpoPushMessageType {
  return {
    to: input.token,
    title: input.title,
    body: input.body,
    sound: "default",
    channelId: DEFAULT_ANDROID_CHANNEL_ID,
    data: { ...input.data, ...(input.url ? { url: input.url } : {}) },
  };
}

/**
 * Optional shared secret. With "enhanced push security" enabled in the Expo
 * dashboard, requests without it are refused — which is what stops a leaked
 * push token from letting anyone impersonate this server.
 */
function pushAuthHeaders(): Record<string, string> {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * Sends every message, in batches, and reports which tokens are dead.
 *
 * A failed *batch* is logged and skipped rather than thrown: one unreachable
 * chunk must not lose the notifications that other chunks would have
 * delivered. A ticket with `status: "ok"` only means Expo accepted the
 * message — actual delivery is confirmed by receipts, which this project
 * doesn't poll yet.
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessageType[],
): Promise<ExpoPushResultType> {
  if (messages.length === 0) return { tickets: [], unregisteredTokens: [] };

  const tickets: ExpoPushTicketType[] = [];
  const sent: ExpoPushMessageType[] = [];

  for (const chunk of chunkPushMessages(messages)) {
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...pushAuthHeaders(),
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error(
          `Expo push request failed with ${response.status}`,
          await response.text().catch(() => ""),
        );
        continue;
      }

      const payload = (await response.json()) as {
        data?: ExpoPushTicketType[];
        errors?: unknown[];
      };

      if (payload.errors?.length) {
        console.error("Expo push responded with errors", payload.errors);
      }

      // Only chunks that produced tickets are paired, so the index link
      // between `sent` and `tickets` stays exact.
      if (payload.data) {
        sent.push(...chunk);
        tickets.push(...payload.data);
      }
    } catch (error) {
      console.error("Expo push request threw", error);
    }
  }

  return {
    tickets,
    unregisteredTokens: collectUnregisteredTokens(sent, tickets),
  };
}
