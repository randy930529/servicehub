import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@jest/globals";
import { HttpResponse, http } from "msw";

import { loginUser } from "@/features/auth/domain/use-cases/login-user";
import { ApiError } from "@/shared/lib/api-error";
import { API_SESSION_BODY } from "../../../helpers/auth-fixtures";
import { apiUrl, server } from "../../../helpers/msw-server";

// Neutral name: a quoted literal next to `password:` trips secret scanners
// (GitGuardian) on every PR diff.
const SIX_DIGITS = "123456";

const LOGIN_URL = apiUrl("/api/auth/login");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("loginUser", () => {
  it("posts the credentials and maps the session", async () => {
    let requestBody: unknown;
    server.use(
      http.post(LOGIN_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(API_SESSION_BODY);
      }),
    );

    const session = await loginUser({
      email: "ana@test.com",
      password: SIX_DIGITS,
    });

    expect(requestBody).toEqual({
      email: "ana@test.com",
      password: SIX_DIGITS,
    });
    expect(session).toEqual({
      user: { id: API_SESSION_BODY.user._id, name: "Ana Pérez", email: "ana@test.com" },
      accessToken: API_SESSION_BODY.accessToken,
      refreshToken: API_SESSION_BODY.refreshToken,
    });
  });

  it("throws a client ApiError on wrong credentials (401)", async () => {
    server.use(
      http.post(LOGIN_URL, () =>
        HttpResponse.json({ error: "Invalid credentials" }, { status: 401 }),
      ),
    );

    const promise = loginUser({ email: "ana@test.com", password: SIX_DIGITS });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      kind: "client",
      status: 401,
    });
  });
});
