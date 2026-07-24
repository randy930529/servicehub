import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { TextInput } from "@/shared/components/ui/text-input";
import { Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";
import { registerUser } from "../domain/use-cases";
import { RegisterSchema, type RegisterForm } from "../validation/auth.schema";
import { useAuthStore } from "../stores/auth.store";

export function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuthStore();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(data: RegisterForm) {
    try {
      const session = await registerUser(data);
      await login(session);
      router.replace("/");
    } catch (error) {
      setError("root", {
        message:
          error instanceof ApiError && error.status === 409
            ? "Este correo ya está registrado"
            : "No pudimos crear tu cuenta. Inténtalo de nuevo.",
      });
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + Spacing.four,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.brand}>
            ServiceHub
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Crea tu cuenta
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Nombre completo"
                placeholder="Juan Pérez"
                testID="register-name-input"
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Correo electrónico"
                placeholder="tu@correo.com"
                testID="register-email-input"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
                testID="register-password-input"
                secureTextEntry
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Confirmar contraseña"
                placeholder="Repite tu contraseña"
                testID="register-confirm-password-input"
                secureTextEntry
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          {errors.root?.message ? (
            <ThemedText
              type="small"
              style={styles.serverError}
              testID="register-server-error"
            >
              {errors.root.message}
            </ThemedText>
          ) : null}

          <Button
            label="Crear cuenta"
            testID="register-submit-button"
            variant="primary"
            size="lg"
            fullWidth
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            ¿Ya tienes cuenta?
          </ThemedText>
          <Button
            label="Iniciar sesión"
            variant="outline"
            size="md"
            fullWidth
            onPress={() => router.back()}
          />
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
  },
  tagline: {
    fontSize: 16,
  },
  form: {
    gap: Spacing.three,
  },
  serverError: {
    // Same error red as the UI kit's TextInput.
    color: "#ef4444",
  },
  footer: {
    gap: Spacing.two,
    alignItems: "center",
    marginTop: "auto",
  },
});
