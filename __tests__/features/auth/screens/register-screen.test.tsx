import { RegisterScreen } from "@/features/auth/screens/register-screen";
import { beforeEach, describe, expect, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

const mockLogin = jest.fn();
const mockRegisterUser = jest.fn<(data: unknown) => Promise<unknown>>();

// Dummy values with neutral, length-based names: quoted literals typed into
// password fields trigger secret scanners (GitGuardian) on every PR diff.
const EIGHT_DIGITS = "12345678";
const OTHER_TEXT = "diferente";

// What the (mocked) use-case resolves with: a full session, not a bare token.
const FAKE_SESSION = {
  user: { id: "u1", name: "Juan Pérez", email: "juan@correo.com" },
  accessToken: "stub-access-1",
  refreshToken: "stub-refresh-1",
};

jest.mock("@/features/auth/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));

// The real use-case hits the network; screen tests only care that the screen
// wires form → use-case → store.
jest.mock("@/features/auth/domain/use-cases", () => ({
  registerUser: (data: unknown) => mockRegisterUser(data),
}));

describe("RegisterScreen", () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockRegisterUser.mockReset();
    mockRegisterUser.mockResolvedValue(FAKE_SESSION);
  });

  test("renders all form fields", async () => {
    await render(<RegisterScreen />);
    expect(await screen.findByTestId("register-name-input")).toBeTruthy();
    expect(await screen.findByTestId("register-email-input")).toBeTruthy();
    expect(await screen.findByTestId("register-password-input")).toBeTruthy();
    expect(
      await screen.findByTestId("register-confirm-password-input"),
    ).toBeTruthy();
  });

  test("shows name validation error for short name", async () => {
    await render(<RegisterScreen />);

    fireEvent.changeText(await screen.findByTestId("register-name-input"), "J");
    fireEvent.press(await screen.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Mínimo 2 caracteres")).toBeTruthy();
    });
  });

  test("shows error when passwords do not match", async () => {
    await render(<RegisterScreen />);

    fireEvent.changeText(
      await screen.findByTestId("register-name-input"),
      "Juan",
    );
    fireEvent.changeText(
      await screen.findByTestId("register-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await screen.findByTestId("register-password-input"),
      EIGHT_DIGITS,
    );
    fireEvent.changeText(
      await screen.findByTestId("register-confirm-password-input"),
      OTHER_TEXT,
    );
    fireEvent.press(await screen.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Las contraseñas no coinciden")).toBeTruthy();
    });
  });

  test("calls auth store login on valid submission", async () => {
    await render(<RegisterScreen />);

    fireEvent.changeText(
      await screen.findByTestId("register-name-input"),
      "Juan Pérez",
    );
    fireEvent.changeText(
      await screen.findByTestId("register-email-input"),
      "juan@correo.com",
    );
    fireEvent.changeText(
      await screen.findByTestId("register-password-input"),
      EIGHT_DIGITS,
    );
    fireEvent.changeText(
      await screen.findByTestId("register-confirm-password-input"),
      EIGHT_DIGITS,
    );
    fireEvent.press(await screen.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(FAKE_SESSION);
    });
  });
});
