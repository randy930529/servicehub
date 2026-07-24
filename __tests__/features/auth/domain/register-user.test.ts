import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@jest/globals";
import { HttpResponse, http } from "msw";

import { registerUser } from "@/features/auth/domain/use-cases/register-user";
import { API_SESSION_BODY } from "../../../helpers/auth-fixtures";
import { apiUrl, server } from "../../../helpers/msw-server";

// Neutral name: a quoted literal next to `password:` trips secret scanners
// (GitGuardian) on every PR diff.
const EIGHT_DIGITS = "12345678";

const REGISTER_URL = apiUrl("/api/auth/register");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("registerUser", () => {
  it("posts name/email/password (never confirmPassword) and maps the session", async () => {
    let requestBody: unknown;
    server.use(
      http.post(REGISTER_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(API_SESSION_BODY, { status: 201 });
      }),
    );

    const session = await registerUser({
      name: "Ana Pérez",
      email: "ana@test.com",
      password: EIGHT_DIGITS,
      // Extra form-only fields must not leak to the API.
      confirmPassword: EIGHT_DIGITS,
    } as never);

    expect(requestBody).toEqual({
      name: "Ana Pérez",
      email: "ana@test.com",
      password: EIGHT_DIGITS,
    });
    expect(session.accessToken).toBe(API_SESSION_BODY.accessToken);
    expect(session.refreshToken).toBe(API_SESSION_BODY.refreshToken);
    expect(session.user.id).toBe(API_SESSION_BODY.user._id);
  });

  it("throws a client ApiError when the email is taken (409)", async () => {
    server.use(
      http.post(REGISTER_URL, () =>
        HttpResponse.json(
          { error: "Email already registered" },
          { status: 409 },
        ),
      ),
    );

    await expect(
      registerUser({
        name: "Ana Pérez",
        email: "ana@test.com",
        password: EIGHT_DIGITS,
      }),
    ).rejects.toMatchObject({ kind: "client", status: 409 });
  });
});
