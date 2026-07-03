import { RegisterScreen } from "@/features/auth/screens/register-screen";
import { beforeEach, describe, expect, jest } from "@jest/globals";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

const mockLogin = jest.fn();

jest.mock("@/features/auth/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));

describe("RegisterScreen", () => {
  beforeEach(() => {
    mockLogin.mockClear();
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
      "12345678",
    );
    fireEvent.changeText(
      await screen.findByTestId("register-confirm-password-input"),
      "diferente",
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
      "12345678",
    );
    fireEvent.changeText(
      await screen.findByTestId("register-confirm-password-input"),
      "12345678",
    );
    fireEvent.press(await screen.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("mock-token-register");
    });
  });
});
