import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

import { MESSAGE_MAX_LENGTH } from "@/app/lib/helpers/chat";

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    /**
     * Who wrote it. There is no recipient field: the conversation already
     * says who the two people are, and storing it twice is a second thing to
     * keep in sync.
     */
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: MESSAGE_MAX_LENGTH,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/**
 * The history query: one conversation, newest first. Also what the read mark
 * is compared against, so the sort has to be indexed rather than in memory.
 */
messageSchema.index({ conversation: 1, createdAt: -1 });

export type MessageDocument = InferSchemaType<typeof messageSchema>;

/**
 * Reuse the compiled model across hot-reloads (Next.js re-imports modules),
 * otherwise Mongoose throws "Cannot overwrite model once compiled".
 */
export const Message: Model<MessageDocument> =
  (models.Message as Model<MessageDocument>) ||
  model<MessageDocument>("Message", messageSchema);
