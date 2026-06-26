import { type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type CardProps = ViewProps & {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
};

export function Card({
  title,
  subtitle,
  footer,
  padding = "md",
  style,
  children,
  ...rest
}: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        style,
      ]}
      {...rest}
    >
      {(title || subtitle) && (
        <View style={[styles.header, paddingStyles[padding]]}>
          {title && <ThemedText type="smallBold">{title}</ThemedText>}
          {subtitle && (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          )}
        </View>
      )}

      {children && (
        <View style={padding !== "none" && paddingStyles[padding]}>
          {children}
        </View>
      )}

      {footer && (
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.backgroundSelected },
            paddingStyles[padding],
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    gap: 2,
  },
  footer: {
    borderTopWidth: 1,
  },
});

const paddingStyles = StyleSheet.create({
  none: {},
  sm: { padding: Spacing.two },
  md: { padding: Spacing.three },
  lg: { padding: Spacing.four },
});
