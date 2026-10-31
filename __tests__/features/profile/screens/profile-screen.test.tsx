import type { ReactElement } from "react";

import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react-native";

import type { UserProfile } from "@/features/profile/domain/types";
import { getProfile } from "@/features/profile/domain/use-cases";
import { ProfileScreen } from "@/features/profile/screens/profile-screen";

jest.mock("@/features/profile/domain/use-cases", () => ({
  getProfile: jest.fn(),
}));

const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

const PROFILE: UserProfile = {
  id: "u1",
  name: "Demo",
  email: "demo@servicehub.dev",
  bio: "",
  phone: "",
  avatarUrl: null,
};

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockGetProfile.mockReset();
  mockGetProfile.mockResolvedValue(PROFILE);
});

describe("ProfileScreen", () => {
  test("hands signing out to whoever mounted it", async () => {
    // The screen never touches the session itself: the auth store and the
    // query cache both live outside this feature, so the route assembles the
    // two and this is only the button.
    const onLogout = jest.fn();

    const { findByTestId } = await renderWithClient(
      <ProfileScreen onLogout={onLogout} />,
    );

    await fireEvent.press(await findByTestId("profile-logout-button"));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
