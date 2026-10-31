/**
 * The chat rules that are worth stating without a database or a socket in the
 * way: who a conversation is keyed by, and whether the other side has seen it.
 */

/**
 * Longest message we store. Generous for a chat line, and bounded so one
 * client cannot push a megabyte into every reader's conversation list through
 * the denormalized preview.
 */
export const MESSAGE_MAX_LENGTH = 2000;

/**
 * Deterministic key for a pair of users: the same two people produce the same
 * string no matter who opens the conversation first. That is what makes
 * "one conversation per pair" enforceable.
 *
 * It has to be a **scalar**. The obvious alternative — a unique index on the
 * `members.user` array — would be a multikey index, and unique on multikey
 * means "no two documents share *any* element": it would allow each user
 * exactly one conversation, ever.
 */
export function conversationPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/**
 * Does this conversation have something new for `viewerId`?
 *
 * A **boolean, not a count**. The count would need a per-conversation query
 * against each member's own read mark, while this answers from the
 * denormalized last message that the list already loads. A dot is also all
 * the list shows. If a number is ever wanted, that is the moment to pay for
 * the aggregate.
 *
 * Your own message never counts as unread — writing it is reading it.
 */
export function hasUnread(input: {
  lastMessage?: { sender: string; createdAt: Date } | null;
  viewerId: string;
  lastReadAt?: Date | null;
}): boolean {
  const { lastMessage, viewerId, lastReadAt } = input;

  if (!lastMessage) return false;
  if (lastMessage.sender === viewerId) return false;
  // Never opened it: everything in it is new.
  if (!lastReadAt) return true;

  return lastMessage.createdAt.getTime() > lastReadAt.getTime();
}

/**
 * The person on the other side. A 1:1 conversation has exactly two members,
 * so "not me" identifies them — and returning `null` rather than throwing
 * keeps a malformed document from taking down the whole list.
 */
export function otherMember<T extends { user: string }>(
  members: T[],
  viewerId: string,
): T | null {
  return members.find((member) => member.user !== viewerId) ?? null;
}
