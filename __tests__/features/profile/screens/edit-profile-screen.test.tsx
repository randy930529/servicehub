import type { ReactElement } from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { UserProfile } from "@/features/profile/domain/types";
import {
  getProfile,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from "@/features/profile/domain/use-cases";
import { pickAvatarFromLibrary } from "@/features/profile/lib/pick-avatar";
import { EditProfileScreen } from "@/features/profile/screens/edit-profile-screen";

jest.mock("@/features/profile/domain/use-cases", () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  removeAvatar: jest.fn(),
}));

// Picking touches the system picker and native image processing.
jest.mock("@/features/profile/lib/pick-avatar", () => ({
  pickAvatarFromLibrary: jest.fn(),
}));

// The global mock in jest.setup returns a fresh router on every render, so
// there is nothing to assert on. A stable `back` lets the save test wait for
// the whole path — submit → mutation → navigate — to finish.
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));

const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockUpdateProfile = updateProfile as jest.MockedFunction<
  typeof updateProfile
>;
const mockUploadAvatar = uploadAvatar as jest.MockedFunction<
  typeof uploadAvatar
>;
const mockRemoveAvatar = removeAvatar as jest.MockedFunction<
  typeof removeAvatar
>;
const mockPickAvatar = pickAvatarFromLibrary as jest.MockedFunction<
  typeof pickAvatarFromLibrary
>;

const PROFILE: UserProfile = {
  id: "user-1",
  name: "Ana Pérez",
  email: "ana@test.com",
  bio: "Electricista",
  phone: "+52 33 1234 5678",
  avatarUrl: "http://localhost:9000/avatars/user-1/a1b2.jpg",
  workingHours: { startHour: 9, endHour: 18, weekdays: [1, 2, 3, 4, 5, 6] },
};

const PICKED_IMAGE = {
  uri: "file:///tmp/avatar.jpg",
  contentType: "image/jpeg",
};

const clients: QueryClient[] = [];

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EditProfileScreen", () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockUpdateProfile.mockReset();
    mockUploadAvatar.mockReset();
    mockRemoveAvatar.mockReset();
    mockPickAvatar.mockReset();
    mockBack.mockReset();

    mockGetProfile.mockResolvedValue(PROFILE);
    mockUpdateProfile.mockResolvedValue(PROFILE);
  });

  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.length = 0;
  });

  test("shows a loading state while the profile is pending", async () => {
    mockGetProfile.mockReturnValue(new Promise<UserProfile>(() => {}));
    await renderScreen(<EditProfileScreen />);

    expect(screen.getByTestId("edit-profile-loading")).toBeTruthy();
  });

  test("prefills the form with the current profile", async () => {
    await renderScreen(<EditProfileScreen />);

    expect((await screen.findByTestId("profile-name-input")).props.value).toBe(
      "Ana Pérez",
    );
    expect((await screen.findByTestId("profile-bio-input")).props.value).toBe(
      "Electricista",
    );
    expect((await screen.findByTestId("profile-phone-input")).props.value).toBe(
      "+52 33 1234 5678",
    );
  });

  test("saves the edited fields and navigates back", async () => {
    await renderScreen(<EditProfileScreen />);

    await fireEvent.changeText(
      await screen.findByTestId("profile-name-input"),
      "Ana María Pérez",
    );
    await fireEvent.press(await screen.findByTestId("profile-submit-button"));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: "Ana María Pérez",
        bio: "Electricista",
        phone: "+52 33 1234 5678",
      }),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  test("blocks the save and shows the message when the name is too short", async () => {
    await renderScreen(<EditProfileScreen />);

    await fireEvent.changeText(await screen.findByTestId("profile-name-input"), "A");
    await fireEvent.press(await screen.findByTestId("profile-submit-button"));

    await waitFor(() =>
      expect(screen.getByText("Mínimo 2 caracteres")).toBeTruthy(),
    );
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  test("rejects a malformed phone before hitting the API", async () => {
    await renderScreen(<EditProfileScreen />);

    await fireEvent.changeText(
      await screen.findByTestId("profile-phone-input"),
      "no-es-tel",
    );
    await fireEvent.press(await screen.findByTestId("profile-submit-button"));

    await waitFor(() =>
      expect(screen.getByText("Ingresa un teléfono válido")).toBeTruthy(),
    );
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  test("uploads the picked image as the new avatar", async () => {
    mockPickAvatar.mockResolvedValue({ status: "picked", image: PICKED_IMAGE });
    mockUploadAvatar.mockResolvedValue({
      ...PROFILE,
      avatarUrl: "http://localhost:9000/avatars/user-1/new.jpg",
    });

    await renderScreen(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("avatar-change-button"));

    await waitFor(() =>
      expect(mockUploadAvatar).toHaveBeenCalledWith(PICKED_IMAGE),
    );
    // The avatar comes back once the upload settles.
    expect(await screen.findByTestId("edit-profile-avatar")).toBeTruthy();
  });

  test("does nothing when the user cancels the picker", async () => {
    mockPickAvatar.mockResolvedValue({ status: "canceled" });

    await renderScreen(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("avatar-change-button"));

    await waitFor(() => expect(mockPickAvatar).toHaveBeenCalledTimes(1));
    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(screen.queryByTestId("avatar-notice")).toBeNull();
  });

  test("explains the problem when photo permission is denied", async () => {
    mockPickAvatar.mockResolvedValue({ status: "denied" });

    await renderScreen(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("avatar-change-button"));

    expect(await screen.findByTestId("avatar-notice")).toBeTruthy();
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  test("reports a failed upload instead of failing silently", async () => {
    mockPickAvatar.mockResolvedValue({ status: "picked", image: PICKED_IMAGE });
    mockUploadAvatar.mockRejectedValue(new Error("storage unreachable"));

    await renderScreen(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("avatar-change-button"));

    expect(await screen.findByTestId("avatar-notice")).toBeTruthy();
  });

  test("removes the avatar", async () => {
    mockRemoveAvatar.mockResolvedValue({ ...PROFILE, avatarUrl: null });

    await renderScreen(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("avatar-remove-button"));

    await waitFor(() => expect(mockRemoveAvatar).toHaveBeenCalledTimes(1));
    // With no avatar left, the remove action is gone too.
    await waitFor(() =>
      expect(screen.queryByTestId("avatar-remove-button")).toBeNull(),
    );
  });
});
