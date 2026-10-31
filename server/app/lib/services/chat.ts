import { Types, isValidObjectId } from "mongoose";

import type {
  PaginationParams,
  PublicConversationType,
  PublicMessageType,
} from "@/app/lib/definitions";
import {
  buildMeta,
  conversationPairKey,
  getSkip,
  hasUnread,
  otherMember,
} from "@/app/lib/helpers";
import { Conversation, Message, User } from "@/app/lib/models";
import { connectToDatabase } from "@/app/lib/mongoose";
import { buildAvatarUrl } from "@/app/lib/storage";

/** Failure shape shared by every entry point here, as in the payments service. */
type FailureType = { ok: false; status: number; message: string };

/** Mongo's duplicate-key error. An upsert can still raise it under a race. */
const DUPLICATE_KEY = 11000;

function toObjectId(id: string): Types.ObjectId {
  return Types.ObjectId.createFromHexString(id);
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** A conversation member once the populated user has been flattened out. */
type FlatMemberType = {
  user: string;
  name: string;
  avatarUrl: string | null;
  lastReadAt: Date | null;
};

type RawMemberType = {
  user: unknown;
  lastReadAt?: Date | null;
};

/**
 * Flattens `members` into plain data, whether or not `user` was populated.
 *
 * Everything downstream — the read marks, the peer lookup, `hasUnread` —
 * compares ids as strings, so it cannot silently fail the way
 * `ObjectId === string` does.
 */
function flattenMembers(members: RawMemberType[]): FlatMemberType[] {
  return members.map((member) => {
    const populated = member.user as {
      _id?: unknown;
      name?: string;
      avatarKey?: string | null;
    } | null;

    const isPopulated =
      populated !== null && typeof populated === "object" && "name" in populated;

    return {
      user: String(isPopulated ? populated?._id : member.user),
      name: isPopulated ? (populated?.name ?? "") : "",
      avatarUrl: isPopulated
        ? buildAvatarUrl(populated?.avatarKey ?? null)
        : null,
      lastReadAt: member.lastReadAt ?? null,
    };
  });
}

type RawConversationType = {
  _id: unknown;
  members: RawMemberType[];
  lastMessage?: {
    body: string;
    sender: unknown;
    createdAt: Date;
  } | null;
  updatedAt?: Date | null;
};

/**
 * Resolves a conversation **for one viewer**: who the other person is, and
 * whether there is anything new for them. The same document renders
 * differently for each side, which is why this takes the viewer.
 */
function toPublicConversation(
  conversation: RawConversationType,
  viewerId: string,
): PublicConversationType {
  const members = flattenMembers(conversation.members);
  const peer = otherMember(members, viewerId);
  const me = members.find((member) => member.user === viewerId) ?? null;

  const lastMessage = conversation.lastMessage
    ? {
        body: conversation.lastMessage.body,
        senderId: String(conversation.lastMessage.sender),
        createdAt: toIsoString(conversation.lastMessage.createdAt),
      }
    : null;

  return {
    _id: String(conversation._id),
    peer: {
      _id: peer?.user ?? "",
      // A deleted account leaves the thread readable instead of breaking the
      // list: there is still history worth showing.
      name: peer?.name || "Usuario",
      avatarUrl: peer?.avatarUrl ?? null,
    },
    lastMessage,
    hasUnread: hasUnread({
      lastMessage: conversation.lastMessage
        ? {
            sender: String(conversation.lastMessage.sender),
            createdAt: conversation.lastMessage.createdAt,
          }
        : null,
      viewerId,
      lastReadAt: me?.lastReadAt ?? null,
    }),
    updatedAt: toIsoString(conversation.updatedAt),
  };
}

export function toPublicMessage(
  message: {
    _id: unknown;
    conversation: unknown;
    sender: unknown;
    body: string;
    createdAt?: Date | string | null;
  },
  peerLastReadAt: Date | null,
): PublicMessageType {
  const createdAt = message.createdAt;
  const sentAt = createdAt instanceof Date ? createdAt : null;

  return {
    _id: String(message._id),
    conversationId: String(message.conversation),
    senderId: String(message.sender),
    body: message.body,
    createdAt: toIsoString(createdAt),
    // "Seen" is a comparison, not a flag: the peer's single read mark covers
    // every message at or before it.
    readByPeer:
      peerLastReadAt !== null &&
      sentAt !== null &&
      sentAt.getTime() <= peerLastReadAt.getTime(),
  };
}

export type OpenConversationResultType =
  | { ok: true; conversation: PublicConversationType; created: boolean }
  | FailureType;

/**
 * `POST /api/conversations` — the thread with one person, created on first
 * contact.
 *
 * Find-or-create arbitrated by the unique `pairKey` index rather than by a
 * read-then-write: two people tapping "message" at the same instant would
 * both find nothing and both insert. Here the loser of the index catches a
 * duplicate key and reads the winner's document.
 */
export async function openConversation(
  userId: string,
  peerId: string,
): Promise<OpenConversationResultType> {
  if (!isValidObjectId(peerId)) {
    return { ok: false, status: 404, message: "User not found" };
  }

  if (peerId === userId) {
    return {
      ok: false,
      status: 409,
      message: "Cannot open a conversation with yourself",
    };
  }

  await connectToDatabase();

  const peer = await User.findById(peerId).select("name avatarKey");
  if (!peer) {
    return { ok: false, status: 404, message: "User not found" };
  }

  const pairKey = conversationPairKey(userId, peerId);
  let created = false;

  try {
    const result = await Conversation.updateOne(
      { pairKey },
      {
        $setOnInsert: {
          pairKey,
          members: [
            { user: toObjectId(userId), lastReadAt: null },
            { user: toObjectId(peerId), lastReadAt: null },
          ],
          lastMessage: null,
        },
      },
      { upsert: true },
    );
    created = result.upsertedCount > 0;
  } catch (error) {
    // Lost the insert race. The other request's document is the one that
    // exists now, which is exactly what should be returned.
    if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
  }

  const conversation = await Conversation.findOne({ pairKey })
    .populate({ path: "members.user", select: "name avatarKey" })
    .lean();

  if (!conversation) {
    return { ok: false, status: 500, message: "Could not open conversation" };
  }

  return {
    ok: true,
    created,
    conversation: toPublicConversation(
      conversation as unknown as RawConversationType,
      userId,
    ),
  };
}

/**
 * `GET /api/conversations` — the caller's threads, most recently active first.
 *
 * Not paginated: a person's chat list is short, and the ordering already puts
 * what matters on top. The preview and the unread dot both come from the
 * denormalized `lastMessage`, so this is one query for the whole screen.
 */
export async function listConversations(
  userId: string,
): Promise<PublicConversationType[]> {
  await connectToDatabase();

  const conversations = await Conversation.find({ "members.user": userId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate({ path: "members.user", select: "name avatarKey" })
    .lean();

  return conversations.map((conversation) =>
    toPublicConversation(conversation as unknown as RawConversationType, userId),
  );
}

/**
 * Loads a conversation **only if the caller is in it**.
 *
 * One query does both jobs, and a non-member is answered exactly like a
 * missing conversation: a 403 would confirm that someone else's thread
 * exists.
 */
async function findMemberConversation(conversationId: string, userId: string) {
  if (!isValidObjectId(conversationId)) return null;

  await connectToDatabase();

  return Conversation.findOne({
    _id: conversationId,
    "members.user": userId,
  }).lean();
}

/** Membership check for the socket gateway's room join. */
export async function isConversationMember(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  return (await findMemberConversation(conversationId, userId)) !== null;
}

export type MessageHistoryResultType =
  | { ok: true; data: PublicMessageType[]; meta: ReturnType<typeof buildMeta> }
  | FailureType;

/**
 * `GET /api/conversations/:id/messages` — the history, **newest first**.
 *
 * Newest-first is what page 1 of a chat should be, and it is the order the
 * index already provides. The screen renders it with an inverted list, so
 * nothing re-sorts on either side.
 */
export async function listMessages(
  conversationId: string,
  userId: string,
  pagination: PaginationParams,
): Promise<MessageHistoryResultType> {
  const conversation = await findMemberConversation(conversationId, userId);

  if (!conversation) {
    return { ok: false, status: 404, message: "Conversation not found" };
  }

  const peer = otherMember(
    flattenMembers(conversation.members as RawMemberType[]),
    userId,
  );

  const [messages, total] = await Promise.all([
    Message.find({ conversation: conversationId })
      .sort({ createdAt: -1 })
      .skip(getSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    Message.countDocuments({ conversation: conversationId }),
  ]);

  return {
    ok: true,
    data: messages.map((message) =>
      toPublicMessage(message, peer?.lastReadAt ?? null),
    ),
    meta: buildMeta(pagination, total),
  };
}

export type SendMessageResultType =
  | { ok: true; message: PublicMessageType }
  | FailureType;

/**
 * Persists a message and updates the conversation's preview.
 *
 * The socket is the only path that calls this — see
 * `lib/sockets/chat-gateway.ts`. Persisting *before* broadcasting is
 * deliberate: a message the recipient saw and the database never stored is
 * worse than one that arrives a few milliseconds late.
 */
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<SendMessageResultType> {
  const { conversationId, senderId, body } = input;

  const conversation = await findMemberConversation(conversationId, senderId);

  if (!conversation) {
    return { ok: false, status: 404, message: "Conversation not found" };
  }

  const message = await Message.create({
    conversation: toObjectId(conversationId),
    sender: toObjectId(senderId),
    body,
  });

  const sentAt = message.createdAt ?? new Date();

  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: {
          body: message.body,
          sender: message.sender,
          createdAt: sentAt,
        },
        // Writing a message is reading the conversation: without this the
        // sender's own message would come back to them as unread.
        "members.$[me].lastReadAt": sentAt,
      },
    },
    { arrayFilters: [{ "me.user": toObjectId(senderId) }] },
  );

  const peer = otherMember(
    flattenMembers(conversation.members as RawMemberType[]),
    senderId,
  );

  return {
    ok: true,
    message: toPublicMessage(message, peer?.lastReadAt ?? null),
  };
}

export type MarkReadResultType = { ok: true; at: Date } | FailureType;

/** Moves the caller's read mark to now. Idempotent by nature. */
export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<MarkReadResultType> {
  if (!isValidObjectId(conversationId)) {
    return { ok: false, status: 404, message: "Conversation not found" };
  }

  await connectToDatabase();

  const at = new Date();

  const result = await Conversation.updateOne(
    { _id: conversationId, "members.user": userId },
    { $set: { "members.$[me].lastReadAt": at } },
    {
      arrayFilters: [{ "me.user": toObjectId(userId) }],
      // Reading must not reorder the list. `updatedAt` is what the list sorts
      // by, and Mongoose bumps it on every update unless told otherwise —
      // opening a thread would quietly float it to the top for both people.
      timestamps: false,
    },
  );

  if (result.matchedCount === 0) {
    return { ok: false, status: 404, message: "Conversation not found" };
  }

  return { ok: true, at };
}
