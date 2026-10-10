import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/shared/components/themed-text";
import { Card } from "@/shared/components/ui/card";
import { Spacing } from "@/shared/constants/theme";

import type { Review } from "../domain/types";
import { useServiceReviewsQuery } from "../queries/use-service-reviews-query";
import { StarRating } from "./star-rating";

function ReviewRow({ review }: { review: Review }) {
  return (
    <Card testID={`review-card-${review.id}`}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{review.authorName}</ThemedText>
        <StarRating value={review.rating} />
      </View>

      {review.comment ? (
        <ThemedText type="small" themeColor="textSecondary">
          {review.comment}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/**
 * A service's reviews, for the booking screen.
 *
 * Not a `FlatList`: this renders inside a `ScrollView` and a nested
 * virtualized list would break scrolling. The API caps the result at 50, so
 * the whole set is small by construction.
 */
export function ServiceReviews({ serviceId }: { serviceId: string }) {
  const { data, isPending, isError } = useServiceReviewsQuery(serviceId);

  if (isPending) {
    return (
      <View style={styles.centered} testID="service-reviews-loading">
        <ActivityIndicator />
      </View>
    );
  }

  // A failed review list must not block booking, so it says so quietly and
  // leaves the rest of the screen alone.
  if (isError) {
    return (
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID="service-reviews-error"
      >
        No pudimos cargar las reseñas.
      </ThemedText>
    );
  }

  if (data.length === 0) {
    return (
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID="service-reviews-empty"
      >
        Todavía no hay reseñas de este servicio.
      </ThemedText>
    );
  }

  return (
    <View style={styles.list} testID="service-reviews">
      <ThemedText type="smallBold">
        Reseñas ({data.length})
      </ThemedText>
      {data.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  centered: {
    paddingVertical: Spacing.three,
  },
});
