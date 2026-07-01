import LoginScreen from "@/app/(auth)/login";
import { beforeEach, describe, expect, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockLogin = jest.fn();
// const mockLogin = jest.fn(() => Promise.resolve());

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  test("renders email and password fields", async () => {
    const utils = await render(<LoginScreen />);
    expect(await utils.findByTestId("login-email-input")).toBeTruthy();
    expect(await utils.findByTestId("login-password-input")).toBeTruthy();
  });

  test("shows email validation error for invalid email", async () => {
    const utils = await render(<LoginScreen />);

    fireEvent.changeText(
      await utils.findByTestId("login-email-input"),
      "invalido",
    );
    fireEvent.changeText(
      await utils.findByTestId("login-password-input"),
      "123456",
    );
    fireEvent.press(await utils.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(utils.getByText("Ingresa un correo válido")).toBeTruthy();
    });
  });

  test("shows password validation error for short password", async () => {
    const utils = await render(<LoginScreen />);

    fireEvent.changeText(
      await utils.findByTestId("login-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await utils.findByTestId("login-password-input"),
      "123",
    );
    fireEvent.press(await utils.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(utils.getByText("Mínimo 6 caracteres")).toBeTruthy();
    });
  });

  test("calls auth store login on valid submission", async () => {
    const utils = await render(<LoginScreen />);

    fireEvent.changeText(
      await utils.findByTestId("login-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await utils.findByTestId("login-password-input"),
      "123456",
    );
    fireEvent.press(await utils.findByTestId("login-submit-button"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("mock-token-login");
    });
  });
});
