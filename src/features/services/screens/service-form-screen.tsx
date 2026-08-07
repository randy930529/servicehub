import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { TextInput } from "@/shared/components/ui/text-input";
import { MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import { ApiError } from "@/shared/lib/api-error";
import { getCurrentCoordinates } from "@/shared/lib/device-location";

import { FilterChip } from "../components/filter-chip";
import type { ServiceInput, ServiceLocation } from "../domain/types";
import { pickServiceImageFromLibrary } from "../lib/pick-service-image";
import {
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useUploadServiceImageMutation,
} from "../queries/use-service-mutations";
import { useServiceQuery } from "../queries/use-service-query";
import {
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_VALUES,
  ServiceSchema,
  centsToPrice,
  priceToCents,
  type ServiceForm,
} from "../validation/service.schema";

const EMPTY_FORM: ServiceForm = {
  name: "",
  description: "",
  category: "hogar",
  price: "",
};

/**
 * Create and edit share one screen: the only difference is whether an `id`
 * came in through the route, which decides prefill and which mutation runs.
 */
export function ServiceFormScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const { data: service, isPending: isLoadingService } = useServiceQuery(id);

  const createMutation = useCreateServiceMutation();
  const updateMutation = useUpdateServiceMutation();
  const uploadImageMutation = useUploadServiceImageMutation();

  /**
   * Image and location live outside the form: they're not text fields, and the
   * image is uploaded as soon as it's picked so the submit only carries a key.
   */
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [location, setLocation] = useState<ServiceLocation | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceForm>({
    resolver: zodResolver(ServiceSchema),
    defaultValues: EMPTY_FORM,
    values: service
      ? {
          name: service.name,
          description: service.description,
          category: service.category,
          price: centsToPrice(service.priceFromCents),
        }
      : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  /**
   * Prefill the non-form parts once the service loads.
   *
   * Adjusted during render rather than in an effect — React's recommended
   * shape for "state derived from a prop that changed", and it avoids the
   * extra commit an effect would cause. The id guard is what keeps a re-render
   * from overwriting an image the user just picked.
   */
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  if (service && service.id !== prefilledId) {
    setPrefilledId(service.id);
    setImagePreview(service.imageUrl);
    setLocation(service.location);
  }

  async function onPickImage() {
    setImageNotice(null);
    const result = await pickServiceImageFromLibrary();

    if (result.status === "denied") {
      setImageNotice("Necesitamos acceso a tus fotos para añadir una imagen.");
      return;
    }
    if (result.status === "failed") {
      setImageNotice("No pudimos procesar la imagen. Prueba con otra foto.");
      return;
    }
    if (result.status === "canceled") return;

    // Show the local file immediately; the upload runs behind it.
    setImagePreview(result.image.uri);

    try {
      const key = await uploadImageMutation.mutateAsync(result.image);
      setImageKey(key);
    } catch {
      setImagePreview(service?.imageUrl ?? null);
      setImageNotice("No pudimos subir la imagen. Inténtalo de nuevo.");
    }
  }

  function onRemoveImage() {
    setImageNotice(null);
    setImagePreview(null);
    // Explicit null (not undefined): that's how the API is told to clear it.
    setImageKey(null);
  }

  async function onUseCurrentLocation() {
    setLocationNotice(null);
    setIsLocating(true);
    try {
      const result = await getCurrentCoordinates();
      if (result.status === "granted") {
        setLocation(result.coordinates);
        return;
      }
      setLocationNotice(
        result.status === "denied"
          ? "Necesitamos tu ubicación para que te encuentren por cercanía."
          : "No pudimos obtener tu ubicación. Inténtalo de nuevo.",
      );
    } finally {
      setIsLocating(false);
    }
  }

  async function onSubmit(form: ServiceForm) {
    const input: ServiceInput = {
      name: form.name,
      description: form.description,
      category: form.category,
      priceFromCents: priceToCents(form.price),
      location,
    };

    // On create the key is always sent; on edit only when it changed, so an
    // untouched photo is left alone instead of being cleared.
    const imageChanged = imageKey !== null || imagePreview === null;

    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          changes: imageChanged ? { ...input, imageKey } : input,
        });
      } else {
        await createMutation.mutateAsync({ ...input, imageKey });
      }
      router.back();
    } catch (error) {
      setError("root", { message: submitErrorMessage(error) });
    }
  }

  if (isEditing && isLoadingService) {
    return (
      <ThemedView style={styles.centered} testID="service-form-loading">
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const isUploading = uploadImageMutation.isPending;

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
        <ThemedText type="subtitle">
          {isEditing ? "Editar servicio" : "Publicar servicio"}
        </ThemedText>

        <ThemedView style={styles.imageSection}>
          {isUploading ? (
            <ThemedView style={styles.imageBusy} testID="service-image-uploading">
              <ActivityIndicator />
            </ThemedView>
          ) : imagePreview ? (
            <Image
              source={{ uri: imagePreview }}
              style={styles.image}
              contentFit="cover"
              testID="service-image-preview"
            />
          ) : (
            <ThemedView
              style={[
                styles.imagePlaceholder,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText type="small" themeColor="textSecondary">
                Sin imagen
              </ThemedText>
            </ThemedView>
          )}

          <View style={styles.imageActions}>
            <Button
              label={imagePreview ? "Cambiar imagen" : "Añadir imagen"}
              variant="outline"
              size="sm"
              testID="service-image-button"
              disabled={isUploading}
              onPress={onPickImage}
            />
            {imagePreview ? (
              <Button
                label="Quitar"
                variant="ghost"
                size="sm"
                testID="service-image-remove-button"
                disabled={isUploading}
                onPress={onRemoveImage}
              />
            ) : null}
          </View>

          {imageNotice ? (
            <ThemedText
              type="small"
              style={styles.errorText}
              testID="service-image-notice"
            >
              {imageNotice}
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Nombre del servicio"
                placeholder="Limpieza de hogar"
                testID="service-name-input"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Descripción"
                placeholder="Cuenta qué incluye, cuánto dura y qué necesitas del cliente"
                testID="service-description-input"
                multiline
                numberOfLines={5}
                maxLength={600}
                style={styles.multiline}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.description?.message}
                helper={`${value?.length ?? 0}/600`}
              />
            )}
          />

          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Precio desde (MXN)"
                placeholder="450"
                testID="service-price-input"
                keyboardType="decimal-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.price?.message}
                helper="Precio inicial; podrás ajustarlo por trabajo."
              />
            )}
          />

          <ThemedView style={styles.field}>
            <ThemedText type="smallBold">Categoría</ThemedText>
            <Controller
              control={control}
              name="category"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chips}>
                  {SERVICE_CATEGORY_VALUES.map((option) => (
                    <FilterChip
                      key={option}
                      label={SERVICE_CATEGORY_LABELS[option]}
                      selected={value === option}
                      onPress={() => onChange(option)}
                      testID={`service-category-${option}`}
                    />
                  ))}
                </View>
              )}
            />
            {errors.category?.message ? (
              <ThemedText type="small" style={styles.errorText}>
                {errors.category.message}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="smallBold">Ubicación</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {location
                ? `Se mostrará a quien busque cerca (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}).`
                : "Sin ubicación no aparecerás en las búsquedas por distancia."}
            </ThemedText>
            <View style={styles.imageActions}>
              <Button
                label={location ? "Actualizar ubicación" : "Usar mi ubicación"}
                variant="outline"
                size="sm"
                testID="service-location-button"
                loading={isLocating}
                onPress={onUseCurrentLocation}
              />
              {location ? (
                <Button
                  label="Quitar"
                  variant="ghost"
                  size="sm"
                  testID="service-location-remove-button"
                  onPress={() => setLocation(null)}
                />
              ) : null}
            </View>
            {locationNotice ? (
              <ThemedText
                type="small"
                style={styles.errorText}
                testID="service-location-notice"
              >
                {locationNotice}
              </ThemedText>
            ) : null}
          </ThemedView>

          {errors.root?.message ? (
            <ThemedText
              type="small"
              style={styles.errorText}
              testID="service-server-error"
            >
              {errors.root.message}
            </ThemedText>
          ) : null}

          <Button
            label={isEditing ? "Guardar cambios" : "Publicar servicio"}
            variant="primary"
            size="lg"
            fullWidth
            testID="service-submit-button"
            loading={isSubmitting}
            disabled={isUploading}
            onPress={handleSubmit(onSubmit)}
          />

          <Button
            label="Cancelar"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
            style={styles.selfCentered}
          />
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Tu sesión expiró. Inicia sesión de nuevo.";
    }
    if (error.status === 403) {
      return "Este servicio no es tuyo.";
    }
  }
  return "No pudimos guardar el servicio. Inténtalo de nuevo.";
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selfCentered: {
    alignSelf: "center",
  },
  imageSection: {
    gap: Spacing.two,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  imageBusy: {
    width: "100%",
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
  },
  imageActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  errorText: {
    // Same error red as the UI kit's TextInput.
    color: "#ef4444",
  },
});
