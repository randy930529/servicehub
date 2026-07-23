import { useAuthStore } from "@/features/auth/stores/auth.store";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// In-memory SecureStore: the store's persistence contract without native
// deps. (jest.mock is hoisted above the imports; `mock*` consts are read
// lazily at call time.)
const mockStorage = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  setItemAsync: async (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  getItemAsync: async (key: string) => mockStorage.get(key) ?? null,
  deleteItemAsync: async (key: string) => {
    mockStorage.delete(key);
  },
}));

// The store's logout revokes the session server-side; keep that off the
// network in unit tests.
const mockRevokeSession = jest.fn<(token: string) => Promise<void>>(
  async () => {},
);
// No jest.fn() here: the hoisted factory runs before the `jest` import binding
// is initialized when the store module loads first.
jest.mock("@/features/auth/domain/use-cases/refresh-session", () => ({
  refreshSession: async () => {
    throw new Error("refreshSession is not exercised by this suite");
  },
  revokeSession: (token: string) => mockRevokeSession(token),
}));

const ACCESS_TOKEN_KEY = "sh_auth_token";
const REFRESH_TOKEN_KEY = "sh_refresh_token";

// Neutral stub values (see GitGuardian note in the screen tests).
const SESSION = {
  user: { id: "u1", name: "Ana", email: "ana@test.com" },
  accessToken: "stub-access-1",
  refreshToken: "stub-refresh-1",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockRevokeSession.mockClear();
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isHydrated: false,
    });
  });

  it("login persists both tokens in SecureStore and exposes the session", async () => {
    await useAuthStore.getState().login(SESSION);

    const state = useAuthStore.getState();
    expect(state.token).toBe("stub-access-1");
    expect(state.refreshToken).toBe("stub-refresh-1");
    expect(state.user).toEqual(SESSION.user);
    expect(mockStorage.get(ACCESS_TOKEN_KEY)).toBe("stub-access-1");
    expect(mockStorage.get(REFRESH_TOKEN_KEY)).toBe("stub-refresh-1");
  });

  it("setTokens replaces the persisted pair (rotation)", async () => {
    await useAuthStore.getState().login(SESSION);
    await useAuthStore.getState().setTokens({
      accessToken: "stub-access-2",
      refreshToken: "stub-refresh-2",
    });

    expect(useAuthStore.getState().token).toBe("stub-access-2");
    expect(mockStorage.get(ACCESS_TOKEN_KEY)).toBe("stub-access-2");
    expect(mockStorage.get(REFRESH_TOKEN_KEY)).toBe("stub-refresh-2");
  });

  it("logout clears state + SecureStore and revokes the session server-side", async () => {
    await useAuthStore.getState().login(SESSION);
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(mockStorage.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(mockStorage.has(REFRESH_TOKEN_KEY)).toBe(false);
    expect(mockRevokeSession).toHaveBeenCalledWith("stub-refresh-1");
  });

  it("hydrate restores the persisted pair", async () => {
    mockStorage.set(ACCESS_TOKEN_KEY, "stub-access-9");
    mockStorage.set(REFRESH_TOKEN_KEY, "stub-refresh-9");

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBe("stub-access-9");
    expect(state.refreshToken).toBe("stub-refresh-9");
    expect(state.isHydrated).toBe(true);
  });

  it("hydrate marks the store hydrated even with no stored session", async () => {
    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isHydrated).toBe(true);
  });
});
