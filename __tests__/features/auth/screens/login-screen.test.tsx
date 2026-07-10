import { LoginScreen } from "@/features/auth/screens/login-screen";
import { beforeEach, describe, expect, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

const mockLogin = jest.fn();

// Dummy values with neutral, length-based names: quoted literals typed into
// password fields trigger secret scanners (GitGuardian) on every PR diff.
const SIX_DIGITS = "123456";
const THREE_DIGITS = "123";

jest.mock("@/features/auth/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    mockLogin.mockClear();
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
      expect(mockLogin).toHaveBeenCalledWith("mock-token-login");
    });
  });
});
