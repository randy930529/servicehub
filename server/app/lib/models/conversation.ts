import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * One member of a conversation, with their own read mark.
 *
 * `lastReadAt` lives here rather than on each message: a read receipt is one
 * write per person per visit this way, instead of one write per message. The
 * cost is that "read" becomes a comparison (`message.createdAt <=
 * lastReadAt`) rather than a stored flag, which is the cheaper side of the
 * trade for a chat that shows a single "seen" marker.
 */
const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** When this member last opened the conversation. `null` = never. */
    lastReadAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * The most recent message, denormalized.
 *
 * The conversation list shows a preview and whether there is something new;
 * without this it would be one extra query per row. Written in the same place
 * the message is created, so it cannot drift independently.
 */
const lastMessageSchema = new Schema(
  {
    body: { type: String, required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const conversationSchema = new Schema(
  {
    /** Exactly two, for now — this is 1:1 chat. */
    members: { type: [memberSchema], required: true },
    /**
     * `conversationPairKey(a, b)`: the sorted ids joined. **Unique**, so the
     * database is what guarantees one conversation per pair — two people
     * tapping "message" at the same instant would both pass a read-then-write
     * check and create two threads.
     *
     * See `helpers/chat.ts` for why this is a scalar and not an index on
     * `members.user`.
     */
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { type: lastMessageSchema, default: null },
  },
  { timestamps: true },
);

/** "My conversations", most recently active first. */
conversationSchema.index({ "members.user": 1, updatedAt: -1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Conversation: Model<ConversationDocument> =
  (models.Conversation as Model<ConversationDocument>) ||
  model<ConversationDocument>("Conversation", conversationSchema);
