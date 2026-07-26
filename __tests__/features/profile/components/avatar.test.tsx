import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { Avatar, getInitials } from "@/features/profile/components/avatar";

describe("getInitials", () => {
  test("takes the first letter of the first two words", () => {
    expect(getInitials("Ana Pérez")).toBe("AP");
  });

  test("uses a single letter for a one-word name", () => {
    expect(getInitials("Ana")).toBe("A");
  });

  test("ignores extra words and surrounding whitespace", () => {
    expect(getInitials("  ana maría pérez lópez  ")).toBe("AM");
  });

  test("falls back to a placeholder for an empty name", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("Avatar", () => {
  test("renders the initials when there is no avatar", async () => {
    const { getByText } = await render(<Avatar uri={null} name="Ana Pérez" />);

    expect(getByText("AP")).toBeTruthy();
  });

  test("renders the image when there is an avatar", async () => {
    const { getByTestId, queryByText } = await render(
      <Avatar
        uri="http://localhost:9000/avatars/user-1/a1b2.jpg"
        name="Ana Pérez"
        testID="avatar"
      />,
    );

    expect(getByTestId("avatar")).toBeTruthy();
    // The initials placeholder must not be rendered underneath.
    expect(queryByText("AP")).toBeNull();
  });
});
