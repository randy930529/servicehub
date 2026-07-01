import RegisterScreen from "@/app/(auth)/register";
import { beforeEach, describe, expect, jest } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockLogin = jest.fn(() => Promise.resolve());

jest.mock("@/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));

describe("RegisterScreen", () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  test("renders all form fields", async () => {
    const utils = await render(<RegisterScreen />);
    expect(await utils.findByTestId("register-name-input")).toBeTruthy();
    expect(await utils.findByTestId("register-email-input")).toBeTruthy();
    expect(await utils.findByTestId("register-password-input")).toBeTruthy();
    expect(
      await utils.findByTestId("register-confirm-password-input"),
    ).toBeTruthy();
  });

  test("shows name validation error for short name", async () => {
    const utils = await render(<RegisterScreen />);

    fireEvent.changeText(await utils.findByTestId("register-name-input"), "J");
    fireEvent.press(await utils.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(utils.getByText("Mínimo 2 caracteres")).toBeTruthy();
    });
  });

  test("shows error when passwords do not match", async () => {
    const utils = await render(<RegisterScreen />);

    fireEvent.changeText(
      await utils.findByTestId("register-name-input"),
      "Juan",
    );
    fireEvent.changeText(
      await utils.findByTestId("register-email-input"),
      "a@b.com",
    );
    fireEvent.changeText(
      await utils.findByTestId("register-password-input"),
      "12345678",
    );
    fireEvent.changeText(
      await utils.findByTestId("register-confirm-password-input"),
      "diferente",
    );
    fireEvent.press(await utils.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(utils.getByText("Las contraseñas no coinciden")).toBeTruthy();
    });
  });

  test("calls auth store login on valid submission", async () => {
    const utils = await render(<RegisterScreen />);

    fireEvent.changeText(
      await utils.findByTestId("register-name-input"),
      "Juan Pérez",
    );
    fireEvent.changeText(
      await utils.findByTestId("register-email-input"),
      "juan@correo.com",
    );
    fireEvent.changeText(
      await utils.findByTestId("register-password-input"),
      "12345678",
    );
    fireEvent.changeText(
      await utils.findByTestId("register-confirm-password-input"),
      "12345678",
    );
    fireEvent.press(await utils.findByTestId("register-submit-button"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("mock-token-register");
    });
  });
});
