import type { ChatMessage } from "../domain/types";

/**
 * The cache arithmetic behind a live chat, as pure functions.
 *
 * Both of these decide what the screen shows, and both fail quietly when they
 * are wrong — a duplicated message or a "visto" that never appears looks like
 * a server bug from the outside. Keeping them out of the hook is what makes
 * them testable without a socket.
 */

/**
 * Inserts a message, or replaces the one already there.
 *
 * Deduplication by id is not optional: the sender receives their own message
 * twice (once as the ack, once as the room broadcast), and a reconnect
 * refetches history that overlaps whatever arrived live. The list is
 * newest-first, so a new message goes on the front.
 */
export function upsertMessage(
  current: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  const index = current.findIndex((message) => message.id === incoming.id);

  if (index === -1) return [incoming, ...current];

  const next = [...current];
  next[index] = incoming;
  return next;
}

/**
 * Applies the other side's read mark: everything I sent at or before `at` has
 * been seen.
 *
 * One timestamp covers every earlier message, which is the whole reason the
 * server stores a mark per person instead of a flag per message.
 *
 * "Mine" is identified as *not the peer's* rather than by my own id: a 1:1
 * conversation has exactly two people, and the peer is the one id the screen
 * always has — the signed-in user is not in memory after a cold start.
 */
export function markReadUpTo(
  current: ChatMessage[],
  input: { at: string; peerId: string },
): ChatMessage[] {
  const cutoff = new Date(input.at).getTime();

  // A mark we cannot parse must not silently mark everything as seen.
  if (Number.isNaN(cutoff)) return current;

  let changed = false;

  const next = current.map((message) => {
    if (
      message.senderId === input.peerId ||
      message.readByPeer ||
      !message.createdAt
    ) {
      return message;
    }

    if (new Date(message.createdAt).getTime() > cutoff) return message;

    changed = true;
    return { ...message, readByPeer: true };
  });

  // Same array when nothing moved, so React Query does not re-render the list
  // on every read receipt that changes nothing.
  return changed ? next : current;
}
