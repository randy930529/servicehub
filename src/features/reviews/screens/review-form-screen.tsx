import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { ThemedView } from "@/shared/components/themed-view";
import { Button } from "@/shared/components/ui/button";
import { TextInput } from "@/shared/components/ui/text-input";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/shared/constants/theme";
import { ApiError } from "@/shared/lib/api-error";

import { StarRating } from "../components/star-rating";
import { useCreateReviewMutation } from "../queries/use-create-review-mutation";
import { ReviewSchema, type ReviewForm } from "../validation/review.schema";

function errorHint(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return "Revisa tu conexión e inténtalo de nuevo.";
    }
    // 409 (ya reseñada, cancelada, aún no ocurre) y 429 (demasiadas reseñas)
    // traen un motivo concreto; mostrarlo es más útil que un mensaje genérico.
    if ((error.status === 409 || error.status === 429) && error.message) {
      return error.message;
    }
  }
  return "No pudimos guardar tu reseña. Inténtalo más tarde.";
}

export type ReviewFormScreenProps = {
  reservationId: string;
  serviceName: string;
};

/** Rate a booking that already happened. */
export function ReviewFormScreen({
  reservationId,
  serviceName,
}: ReviewFormScreenProps) {
  const router = useRouter();
  const { mutate, isPending, isError, error } = useCreateReviewMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewForm>({
    resolver: zodResolver(ReviewSchema),
    // 0 rather than a default star: pre-selecting a rating is how you get a
    // catalog full of accidental fives.
    defaultValues: { rating: 0, comment: "" },
  });

  function onSubmit(values: ReviewForm) {
    mutate(
      {
        reservationId,
        rating: values.rating,
        comment: values.comment.length > 0 ? values.comment : null,
      },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Califica el servicio
        </ThemedText>
        <ThemedText type="smallBold">{serviceName}</ThemedText>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Tu calificación
          </ThemedText>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <StarRating
                value={field.value}
                onChange={field.onChange}
                testIDPrefix="review-star"
              />
            )}
          />
          {errors.rating ? (
            <ThemedText type="small" style={styles.error} testID="review-rating-error">
              {errors.rating.message}
            </ThemedText>
          ) : null}
        </View>

        <Controller
          control={control}
          name="comment"
          render={({ field }) => (
            <TextInput
              label="Comentario (opcional)"
              placeholder="¿Cómo fue tu experiencia?"
              multiline
              numberOfLines={4}
              testID="review-comment-input"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.comment?.message}
            />
          )}
        />

        {isError ? (
          <ThemedText type="small" style={styles.error} testID="review-error">
            {errorHint(error)}
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          label="Enviar reseña"
          variant="primary"
          size="lg"
          fullWidth
          loading={isPending}
          testID="review-submit-button"
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  field: {
    gap: Spacing.one,
  },
  error: {
    color: "#d93025",
  },
  actions: {
    alignSelf: "center",
    maxWidth: MaxContentWidth,
    paddingBottom: BottomTabInset + Spacing.two,
    paddingHorizontal: Spacing.four,
    width: "100%",
  },
});
