import { LoginScreen } from "@/features/auth/screens/login-screen";
import { ApiError } from "@/shared/lib/api-error";
import { beforeEach, describe, expect, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

const mockLogin = jest.fn();
const mockLoginUser = jest.fn<(credentials: unknown) => Promise<unknown>>();

// Dummy values with neutral, length-based names: quoted literals typed into
// password fields trigger secret scanners (GitGuardian) on every PR diff.
const SIX_DIGITS = "123456";
const THREE_DIGITS = "123";

// What the (mocked) use-case resolves with: a full session, not a bare token.
const FAKE_SESSION = {
  user: { id: "u1", name: "Ana", email: "a@b.com" },
  accessToken: "stub-access-1",
  refreshToken: "stub-refresh-1",
};

jest.mock("@/features/auth/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));

// The real use-case hits the network; screen tests only care that the screen
// wires form → use-case → store.
jest.mock("@/features/auth/domain/use-cases", () => ({
  loginUser: (credentials: unknown) => mockLoginUser(credentials),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockLoginUser.mockReset();
    mockLoginUser.mockResolvedValue(FAKE_SESSION);
  });

  test("renders email and password fields", async () => {
    await render(<LoginScreen />);
    expect(await screen.findByTestId("login-email-input")).toBeTruthy();
    expect(await screen.findByTestId("login-password-input")).toBeTruthy();
  });

  test("shows email validation error for invalid email", async () => {
    await render(<LoginScreen />);

    fireEvent.changeText(
      await screen.findByTestId("login-email-input"),
      "invalido",
    );
    fireEvent.changeText(
      await screen.findByTestId("login-password-input"),
      SIX_DIGITS,
    );
    fireEvent.press(await screen.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Ingresa un correo válido")).toBeTruthy();
    });
  });

  test("shows password validation error for short password", async () => {
    await render(<LoginScreen />);

    fireEvent.changeText(
      await screen.findByTestId("login-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await screen.findByTestId("login-password-input"),
      THREE_DIGITS,
    );
    fireEvent.press(await screen.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Mínimo 6 caracteres")).toBeTruthy();
    });
  });

  test("calls auth store login on valid submission", async () => {
    await render(<LoginScreen />);

    fireEvent.changeText(
      await screen.findByTestId("login-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await screen.findByTestId("login-password-input"),
      SIX_DIGITS,
    );
    fireEvent.press(await screen.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith({
        email: "a@b.com",
        password: SIX_DIGITS,
      });
      expect(mockLogin).toHaveBeenCalledWith(FAKE_SESSION);
    });
  });

  test("shows a server error message on wrong credentials (401)", async () => {
    mockLoginUser.mockRejectedValue(
      new ApiError("Request failed with status 401", "client", 401),
    );

    await render(<LoginScreen />);

    fireEvent.changeText(
      await screen.findByTestId("login-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await screen.findByTestId("login-password-input"),
      SIX_DIGITS,
    );
    fireEvent.press(await screen.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("login-server-error")).toBeTruthy();
      expect(screen.getByText("Correo o contraseña incorrectos")).toBeTruthy();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
