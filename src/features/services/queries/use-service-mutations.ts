import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PreparedImage } from "@/shared/lib/image-picker";

import type { Service, ServiceInput, ServiceUpdate } from "../domain/types";
import {
  createService,
  deleteService,
  updateService,
  uploadServiceImage,
} from "../domain/use-cases";
import { servicesKeys } from "./keys";

/**
 * Every list in the app (catalog, "mis servicios", each filter combination) is
 * a separate cache entry, so a write invalidates the whole `list` branch rather
 * than trying to patch each one — the alternative is a stale filtered view.
 *
 * Fire-and-forget on purpose: the promise `invalidateQueries` returns only
 * settles once every matching list has refetched, and returning it from
 * `onSuccess` would keep the mutation `isPending` — and the submit button
 * spinning — until then, long after the screen has navigated away. Same shape
 * the profile mutations use.
 */
function useServicesInvalidator() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: servicesKeys.lists() });
  };
}

/** Publishes a new service. */
export function useCreateServiceMutation() {
  const queryClient = useQueryClient();
  const invalidateLists = useServicesInvalidator();

  return useMutation({
    mutationFn: (input: ServiceInput) => createService(input),
    onSuccess: (service: Service) => {
      // Seed the detail cache so opening the new service is instant.
      queryClient.setQueryData(servicesKeys.detail(service.id), service);
      invalidateLists();
    },
  });
}

/** Saves changes to a service the user owns. */
export function useUpdateServiceMutation() {
  const queryClient = useQueryClient();
  const invalidateLists = useServicesInvalidator();

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ServiceUpdate }) =>
      updateService(id, changes),
    onSuccess: (service: Service) => {
      queryClient.setQueryData(servicesKeys.detail(service.id), service);
      invalidateLists();
    },
  });
}

/** Removes a service and evicts it from the cache. */
export function useDeleteServiceMutation() {
  const queryClient = useQueryClient();
  const invalidateLists = useServicesInvalidator();

  return useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: (id: string) => {
      queryClient.removeQueries({ queryKey: servicesKeys.detail(id) });
      invalidateLists();
    },
  });
}

/**
 * Uploads a photo and resolves with its storage key.
 *
 * Deliberately not tied to a service: the image is uploaded while the form is
 * still being filled in, and the key is attached when the form is submitted.
 */
export function useUploadServiceImageMutation() {
  return useMutation({
    mutationFn: (image: PreparedImage) => uploadServiceImage(image),
  });
}
