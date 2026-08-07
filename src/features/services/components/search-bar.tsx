import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
};

/**
 * Search box for the catalog.
 *
 * Deliberately not the UI kit's `TextInput`: that one is built for forms
 * (label, error, helper slots) and this needs the opposite — a single compact
 * row with a leading icon and a clear button.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Buscar servicios",
  testID = "services-search-input",
}: SearchBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
    >
      <SymbolView
        name="magnifyingglass"
        size={18}
        tintColor={theme.textSecondary}
      />

      <TextInput
        testID={testID}
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
      />

      {value.length > 0 ? (
        <Pressable
          testID="services-search-clear"
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
        >
          <SymbolView
            name="xmark.circle.fill"
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two + 2,
  },
});
