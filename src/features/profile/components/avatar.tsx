import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { useTheme } from "@/shared/hooks/use-theme";

type AvatarProps = {
  uri: string | null;
  /** Used for the initials placeholder and the accessibility label. */
  name: string;
  size?: number;
  testID?: string;
};

/** "Ana Pérez" → "AP"; a single word contributes just its first letter. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The user's avatar, falling back to their initials when there's none.
 *
 * `expo-image` handles caching, so the avatar doesn't flash on every render;
 * the upload flow gives each new avatar a fresh key precisely so that cache
 * can't serve a stale image.
 */
export function Avatar({ uri, name, size = 96, testID }: AvatarProps) {
  const theme = useTheme();
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (!uri) {
    return (
      <View
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel={`Avatar de ${name}`}
        style={[
          styles.placeholder,
          circle,
          { backgroundColor: theme.backgroundSelected },
        ]}
      >
        <ThemedText style={{ fontSize: size / 2.8, fontWeight: "700" }}>
          {getInitials(name)}
        </ThemedText>
      </View>
    );
  }

  return (
    <Image
      testID={testID}
      source={{ uri }}
      style={[circle, { backgroundColor: theme.backgroundElement }]}
      contentFit="cover"
      transition={200}
      accessibilityLabel={`Avatar de ${name}`}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
