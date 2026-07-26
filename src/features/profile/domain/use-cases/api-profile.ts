import type { UserProfile } from "../types";

/**
 * Profile payload as returned by the API (`GET`/`PATCH /api/users/me` and both
 * avatar endpoints all answer with the same envelope).
 */
export interface ApiProfileResponse {
  user: {
    _id: string;
    name: string;
    email: string;
    bio: string;
    phone: string;
    avatarUrl: string | null;
  };
}

/** Maps the API shape (Mongo's `_id`) to the domain `UserProfile`. */
export function toUserProfile({ user }: ApiProfileResponse): UserProfile {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    // The API defaults these to "", but older documents predate the fields.
    bio: user.bio ?? "",
    phone: user.phone ?? "",
    avatarUrl: user.avatarUrl ?? null,
  };
}
