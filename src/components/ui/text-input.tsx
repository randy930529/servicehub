import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type TextInputProps = RNTextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
};

export function TextInput({ label, error, helper, style, secureTextEntry, ...rest }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  const borderColor = error
    ? "#ef4444"
    : focused
    ? "#3c87f7"
    : theme.backgroundSelected;

  return (
    <View style={styles.wrapper}>
      {label && (
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      )}

      <View
        style={[
          styles.inputRow,
          { backgroundColor: theme.backgroundElement, borderColor },
          focused && styles.focused,
        ]}
      >
        <RNTextInput
          style={[styles.input, { color: theme.text }, style as object]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((v) => !v)} style={styles.eyeBtn}>
            <SymbolView
              name={hidden ? "eye" : "eye.slash"}
              size={18}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {(error || helper) && (
        <ThemedText
          type="small"
          style={[styles.hint, error ? styles.errorText : { color: theme.textSecondary }]}
        >
          {error ?? helper}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  label: {
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  focused: {
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two + 2,
  },
  eyeBtn: {
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.two,
  },
  hint: {
    marginTop: 2,
  },
  errorText: {
    color: "#ef4444",
  },
});
