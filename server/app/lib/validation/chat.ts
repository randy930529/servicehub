import { z } from "zod";

import { MESSAGE_MAX_LENGTH } from "@/app/lib/helpers/chat";

/**
 * Server-side validation for chat.
 *
 * This one matters more than the other schemas in here: messages arrive over
 * a **socket**, not through a route, so there is no framework in the way and
 * nothing else validating them. `SendMessageSchema` is the whole boundary.
 */

const objectIdField = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Not a valid id");

/** `POST /api/conversations` — open (or reopen) the thread with one person. */
export const OpenConversationSchema = z.object({
  peerId: objectIdField,
});

export type OpenConversationInputType = z.infer<typeof OpenConversationSchema>;

/** The `message:send` socket event. */
export const SendMessageSchema = z.object({
  conversationId: objectIdField,
  /**
   * Trimmed, and empty after trimming is a rejection rather than a stored
   * blank: a message that says nothing still rings the other phone and still
   * becomes the conversation's preview.
   */
  body: z
    .string()
    .trim()
    .min(1, "Message is empty")
    .max(MESSAGE_MAX_LENGTH, "Message is too long"),
});

export type SendMessageInputType = z.infer<typeof SendMessageSchema>;

/** The `conversation:join` and `message:read` socket events. */
export const ConversationRefSchema = z.object({
  conversationId: objectIdField,
});

/** The `typing` socket event. Never persisted — relayed and forgotten. */
export const TypingSchema = z.object({
  conversationId: objectIdField,
  isTyping: z.boolean(),
});
