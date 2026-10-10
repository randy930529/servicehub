import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "@jest/globals";
import { HttpResponse, http } from "msw";

import { getProfile } from "@/features/profile/domain/use-cases/get-profile";
import { removeAvatar } from "@/features/profile/domain/use-cases/remove-avatar";
import { updateProfile } from "@/features/profile/domain/use-cases/update-profile";
import { ApiError } from "@/shared/lib/api-error";
import { apiUrl, server } from "../../../helpers/msw-server";

const PROFILE_ENDPOINT = apiUrl("/api/users/me");
const AVATAR_ENDPOINT = apiUrl("/api/users/me/avatar");

const API_PROFILE = {
  user: {
    _id: "user-1",
    name: "Ana Pérez",
    email: "ana@test.com",
    bio: "Electricista",
    phone: "+52 33 1234 5678",
    avatarUrl: "http://localhost:9000/avatars/user-1/a1b2.jpg",
  },
};

const DOMAIN_PROFILE = {
  id: "user-1",
  name: "Ana Pérez",
  email: "ana@test.com",
  bio: "Electricista",
  phone: "+52 33 1234 5678",
  avatarUrl: "http://localhost:9000/avatars/user-1/a1b2.jpg",
  workingHours: { startHour: 9, endHour: 18, weekdays: [1, 2, 3, 4, 5, 6] },
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getProfile", () => {
  test("maps the API payload to the domain profile", async () => {
    server.use(http.get(PROFILE_ENDPOINT, () => HttpResponse.json(API_PROFILE)));

    expect(await getProfile()).toEqual(DOMAIN_PROFILE);
  });

  test("defaults missing optional fields instead of leaking undefined", async () => {
    server.use(
      http.get(PROFILE_ENDPOINT, () =>
        HttpResponse.json({
          user: { _id: "user-1", name: "Ana", email: "ana@test.com" },
        }),
      ),
    );

    expect(await getProfile()).toEqual({
      id: "user-1",
      name: "Ana",
      email: "ana@test.com",
      bio: "",
      phone: "",
      avatarUrl: null,
      // Absent from the payload: everyone is bookable on the default schedule
      // until they change it, so the mapper fills it rather than leaving a hole.
    workingHours: { startHour: 9, endHour: 18, weekdays: [1, 2, 3, 4, 5, 6] },
    });
  });

  test("throws a client ApiError when the session is gone (401)", async () => {
    server.use(
      http.get(PROFILE_ENDPOINT, () =>
        HttpResponse.json({ message: "Missing access token" }, { status: 401 }),
      ),
      // The shared client retries a 401 once after refreshing; with no refresh
      // token stored, the refresher gives up and the error surfaces.
      http.post(apiUrl("/api/auth/refresh"), () =>
        HttpResponse.json({ message: "Invalid refresh token" }, { status: 401 }),
      ),
    );

    await expect(getProfile()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("updateProfile", () => {
  test("PATCHes only the changed fields", async () => {
    let requestBody: unknown;
    server.use(
      http.patch(PROFILE_ENDPOINT, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(API_PROFILE);
      }),
    );

    await updateProfile({ name: "Ana Pérez" });

    expect(requestBody).toEqual({ name: "Ana Pérez" });
  });

  test("returns the profile as the server normalized it", async () => {
    server.use(
      http.patch(PROFILE_ENDPOINT, () => HttpResponse.json(API_PROFILE)),
    );

    // Sent untrimmed; the response is what counts, not the echo of the input.
    expect(await updateProfile({ name: "  Ana Pérez  " })).toEqual(
      DOMAIN_PROFILE,
    );
  });

  test("surfaces validation failures as a client ApiError", async () => {
    server.use(
      http.patch(PROFILE_ENDPOINT, () =>
        HttpResponse.json(
          {
            type: "VALIDATION_ERROR",
            message: "Invalid body",
            errors: { name: ["Too small"] },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(updateProfile({ name: "A" })).rejects.toMatchObject({
      kind: "client",
      status: 400,
    });
  });
});

describe("removeAvatar", () => {
  test("DELETEs the avatar and returns the profile without one", async () => {
    server.use(
      http.delete(AVATAR_ENDPOINT, () =>
        HttpResponse.json({
          user: { ...API_PROFILE.user, avatarUrl: null },
        }),
      ),
    );

    const profile = await removeAvatar();

    expect(profile.avatarUrl).toBeNull();
    expect(profile.id).toBe("user-1");
  });
});
