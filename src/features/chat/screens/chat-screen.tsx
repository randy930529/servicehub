import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { TextInput } from "@/shared/components/ui/text-input";
import { MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import { ApiError } from "@/shared/lib/api-error";

import type { ChatConnectionStatus, ChatMessage } from "../domain/types";
import { useChatConnection } from "../hooks/use-chat-connection";
import { formatChatTime } from "../lib/format-chat-time";
import { useConversationQuery } from "../queries/use-conversation-query";
import { useMessagesQuery } from "../queries/use-messages-query";

/** How long after the last keystroke the other side stops seeing "escribiendo…". */
const TYPING_IDLE_MS = 2000;

const STATUS_LABELS: Record<ChatConnectionStatus, string> = {
  connecting: "Conectando…",
  online: "En línea",
  offline: "Sin conexión",
};

function errorHint(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return "Revisa tu conexión e inténtalo de nuevo.";
    }
    if (error.status === 404) {
      return "Esta conversación ya no está disponible.";
    }
  }
  return "No pudimos cargar la conversación.";
}

function MessageBubble({
  message,
  isMine,
  now,
}: {
  message: ChatMessage;
  isMine: boolean;
  now: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : null]}
      testID={`message-${message.id}`}
    >
      <View
        style={[
          styles.bubble,
          isMine
            ? styles.bubbleMine
            : { backgroundColor: theme.backgroundElement },
        ]}
      >
        <ThemedText
          style={isMine ? styles.bubbleTextMine : undefined}
          themeColor={isMine ? undefined : "text"}
        >
          {message.body}
        </ThemedText>

        <View style={styles.bubbleMeta}>
          <ThemedText
            type="small"
            themeColor={isMine ? undefined : "textSecondary"}
            style={isMine ? styles.bubbleMetaMine : undefined}
          >
            {formatChatTime(message.createdAt, now)}
          </ThemedText>

          {/* Only on my own messages: "seen" is about the other person. */}
          {isMine && message.readByPeer ? (
            <ThemedText
              type="small"
              style={styles.bubbleMetaMine}
              testID={`message-read-${message.id}`}
            >
              · Visto
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export type ChatScreenProps = {
  /**
   * The other person — the only id this screen is given.
   *
   * The conversation is looked up from it, so opening a chat works the same
   * from the list (where a thread exists) and from a reservation (where it
   * may not). Everything not sent by them is mine, which is also how the
   * screen avoids needing the signed-in user's id at all.
   */
  peerId: string;
  /** Shown in the header until the real one loads. */
  peerName?: string;
  token: string | null;
};

/**
 * One conversation, live.
 *
 * The history comes from the API and the socket writes into the same React
 * Query cache entry, so this screen reads a single list. What it owns on top
 * of that is the composer, the typing signal and the "visto" marker.
 */
export function ChatScreen({ peerId, peerName, token }: ChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [now] = useState(() => Date.now());

  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversation = useConversationQuery(peerId);
  const conversationId = conversation.data?.id ?? "";

  const messages = useMessagesQuery(conversationId);

  const { status, isPeerTyping, send, setTyping } = useChatConnection({
    conversationId,
    peerId,
    token,
  });

  // One failure state for both steps: from the outside, "could not open the
  // conversation" and "could not load its messages" are the same problem.
  const isError = conversation.isError || messages.isError;
  // `isError` first: a disabled query reports `isPending`, so if opening the
  // conversation fails the messages query stays pending forever and the
  // screen would sit on a spinner instead of showing what went wrong.
  const isPending = !isError && (conversation.isPending || messages.isPending);
  const error = conversation.error ?? messages.error;
  const data = messages.data;
  const refetch = () =>
    conversation.isError ? conversation.refetch() : messages.refetch();

  useEffect(
    () => () => {
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
    },
    [],
  );

  /**
   * Typing is announced on the first keystroke and withdrawn after a pause.
   * Emitting on every character would be chatty for no gain — the other side
   * believes the signal for a few seconds anyway.
   */
  const handleChangeText = useCallback(
    (text: string) => {
      setDraft(text);
      setTyping(text.length > 0);

      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
      if (text.length > 0) {
        typingIdleTimer.current = setTimeout(
          () => setTyping(false),
          TYPING_IDLE_MS,
        );
      }
    },
    [setTyping],
  );

  async function handleSend() {
    const body = draft.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setSendError(null);
    // Cleared up front: keeping the text while it sends invites a double tap,
    // and the message is restored below if it did not go through.
    setDraft("");
    setTyping(false);

    const result = await send(body);
    setIsSending(false);

    if (!result.ok) {
      setSendError(result.error);
      setDraft(body);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView edges={["top"]} style={styles.safeArea}>
          <View style={styles.header}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {conversation.data?.peer.name ?? peerName ?? "Chat"}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="chat-status"
            >
              {isPeerTyping ? "Escribiendo…" : STATUS_LABELS[status]}
            </ThemedText>
          </View>

          {isPending ? (
            <View style={styles.centered} testID="chat-loading">
              <ActivityIndicator size="large" color="#3c87f7" />
            </View>
          ) : isError ? (
            <View style={styles.centered} testID="chat-error">
              <ThemedText type="smallBold">
                No pudimos cargar los mensajes
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.centeredText}
              >
                {errorHint(error)}
              </ThemedText>
              <Button
                label="Reintentar"
                variant="primary"
                size="md"
                testID="chat-retry-button"
                onPress={() => refetch()}
              />
            </View>
          ) : (
            <FlatList
              testID="chat-messages"
              // The API returns newest first and an inverted list renders
              // from the bottom up, so the two cancel out: no sorting, and
              // new messages appear where the eye already is.
              inverted
              data={data}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isMine={item.senderId !== peerId}
                  now={now}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty} testID="chat-empty">
                  <ThemedText type="small" themeColor="textSecondary">
                    Escribe el primer mensaje.
                  </ThemedText>
                </View>
              }
            />
          )}

          {sendError ? (
            <ThemedText type="small" style={styles.error} testID="chat-send-error">
              {sendError}
            </ThemedText>
          ) : null}

          <SafeAreaView edges={["bottom"]} style={styles.composer}>
            <View style={styles.composerInput}>
              <TextInput
                placeholder="Escribe un mensaje"
                value={draft}
                onChangeText={handleChangeText}
                multiline
                testID="chat-input"
                onSubmitEditing={handleSend}
              />
            </View>
            <Button
              label="Enviar"
              variant="primary"
              size="md"
              loading={isSending}
              disabled={draft.trim().length === 0}
              testID="chat-send-button"
              onPress={handleSend}
            />
          </SafeAreaView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    alignSelf: "center",
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  header: {
    gap: 2,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  listContent: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  bubbleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubble: {
    borderRadius: 16,
    maxWidth: "80%",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleMine: {
    backgroundColor: "#3c87f7",
  },
  bubbleTextMine: {
    color: "#ffffff",
  },
  bubbleMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "flex-end",
  },
  bubbleMetaMine: {
    color: "#dbeafe",
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.four,
    // The list is inverted, so its empty state would render upside down.
    transform: [{ scaleY: -1 }],
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.two,
    justifyContent: "center",
  },
  centeredText: {
    marginBottom: Spacing.two,
    textAlign: "center",
  },
  error: {
    color: "#d93025",
    paddingHorizontal: Spacing.four,
  },
  composer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  composerInput: {
    flex: 1,
  },
});
