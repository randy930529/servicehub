import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

const BRAND = "#3c87f7";
const BRAND_PRESSED = "#2563eb";
const DESTRUCTIVE = "#ef4444";
const DESTRUCTIVE_PRESSED = "#dc2626";

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyle(variant, theme, pressed),
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style as object,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "destructive" ? "#fff" : BRAND}
        />
      ) : (
        <ThemedText
          style={[styles.label, sizeLabelStyles[size], labelColor(variant, theme)]}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

function variantStyle(
  variant: ButtonVariant,
  theme: ReturnType<typeof useTheme>,
  pressed: boolean
) {
  switch (variant) {
    case "primary":
      return { backgroundColor: pressed ? BRAND_PRESSED : BRAND };
    case "secondary":
      return {
        backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
      };
    case "outline":
      return {
        backgroundColor: pressed ? theme.backgroundElement : "transparent",
        borderWidth: 1.5,
        borderColor: theme.backgroundSelected,
      };
    case "ghost":
      return {
        backgroundColor: pressed ? theme.backgroundElement : "transparent",
      };
    case "destructive":
      return {
        backgroundColor: pressed ? DESTRUCTIVE_PRESSED : DESTRUCTIVE,
      };
  }
}

function labelColor(variant: ButtonVariant, theme: ReturnType<typeof useTheme>) {
  if (variant === "primary" || variant === "destructive") {
    return { color: "#ffffff" };
  }
  if (variant === "ghost" || variant === "outline") {
    return { color: BRAND };
  }
  return { color: theme.text };
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontWeight: "600",
  },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 8 },
  md: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  lg: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three - 2 },
});

const sizeLabelStyles = StyleSheet.create({
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 17 },
});
