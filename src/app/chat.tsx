import { useLocalSearchParams } from "expo-router";

import { useAuthStore } from "@/features/auth";
import { ChatScreen } from "@/features/chat";

/**
 * Only `peerId` is required: the screen looks the conversation up from it, so
 * this route works both from the message list and from a reservation, where
 * no thread exists yet.
 *
 * The app layer is the only place allowed to know about both features, which
 * is why the socket's token is read here and passed down rather than imported
 * by chat.
 */
export default function ChatRoute() {
  const { peerId, peerName } = useLocalSearchParams<{
    peerId: string;
    peerName?: string;
  }>();
  const token = useAuthStore((state) => state.token);

  return <ChatScreen peerId={peerId} peerName={peerName} token={token} />;
}
