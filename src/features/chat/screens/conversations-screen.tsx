import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";

import type { Conversation } from "../domain/types";
import { formatChatTime } from "../lib/format-chat-time";
import { useConversationsQuery } from "../queries/use-conversations-query";

function errorHint(error: unknown): string {
  if (error instanceof ApiError && error.kind === "network") {
    return "Revisa tu conexión e inténtalo de nuevo.";
  }
  return "Estamos teniendo problemas con el servidor. Inténtalo más tarde.";
}

function ConversationRow({
  conversation,
  now,
  onPress,
}: {
  conversation: Conversation;
  /** Pinned by the screen: reading the clock during render is impure. */
  now: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={`conversation-row-${conversation.id}`}
      accessibilityRole="button"
    >
      <Card>
        <View style={styles.rowHeader}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.rowName}>
            {conversation.peer.name}
          </ThemedText>

          <View style={styles.rowMeta}>
            <ThemedText type="small" themeColor="textSecondary">
              {formatChatTime(
                conversation.lastMessage?.createdAt ?? conversation.updatedAt,
                now,
              )}
            </ThemedText>
            {conversation.hasUnread ? (
              // A dot, not a number: the server derives this from the last
              // message and the read mark, with no per-conversation count.
              <View
                style={styles.unreadDot}
                testID={`conversation-unread-${conversation.id}`}
              />
            ) : null}
          </View>
        </View>

        <ThemedText
          type="small"
          themeColor={conversation.hasUnread ? "text" : "textSecondary"}
          numberOfLines={1}
        >
          {conversation.lastMessage?.body ?? "Sin mensajes todavía"}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

/** The caller's conversations, most recently active first. */
export function ConversationsScreen() {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const { data, isPending, isError, error, refetch, isFetching } =
    useConversationsQuery();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Mensajes
        </ThemedText>

        {isPending ? (
          <View style={styles.centered} testID="conversations-loading">
            <ActivityIndicator size="large" color="#3c87f7" />
          </View>
        ) : isError ? (
          <View style={styles.centered} testID="conversations-error">
            <ThemedText type="smallBold">
              No pudimos cargar tus mensajes
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
              loading={isFetching}
              testID="conversations-retry-button"
              onPress={() => refetch()}
            />
          </View>
        ) : (
          <FlatList
            testID="conversations-list"
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                now={now}
                onPress={() =>
                  router.push({
                    pathname: "/chat",
                    params: {
                      peerId: item.peer.id,
                      peerName: item.peer.name,
                    },
                  })
                }
              />
            )}
            // The empty state lives *inside* the list rather than replacing
            // it. Rendered as a sibling it looked identical and left the
            // screen with no way to refresh — which is exactly the screen
            // most likely to be stale, since a first message arrives while
            // you are sitting on "no tienes mensajes".
            ListEmptyComponent={
              <View style={styles.centered} testID="conversations-empty">
                <ThemedText type="smallBold">
                  Todavía no tienes mensajes
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.centeredText}
                >
                  Escribe a un proveedor desde una de tus reservas.
                </ThemedText>
              </View>
            }
            contentContainerStyle={[
              styles.listContent,
              // Without this the empty list is zero-height, and a pull on
              // empty space is not a pull on the list.
              data.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching}
            onRefresh={refetch}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    alignSelf: "center",
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    paddingVertical: Spacing.three,
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowName: {
    flexShrink: 1,
  },
  rowMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
  },
  unreadDot: {
    backgroundColor: "#3c87f7",
    borderRadius: 5,
    height: 10,
    width: 10,
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
  listContent: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
