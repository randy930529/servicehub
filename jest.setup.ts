import { jest } from "@jest/globals";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  }),
  // No route params by default; screens that read them (the service form)
  // override this mock per test file to drive create vs. edit mode.
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-symbols", () => ({
  SymbolView: () => null,
}));

// Geolocation is a sensor, not a fixture: screens only ask for it when the
// distance filter is switched on, and tests that care mock the resolved value.
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getLastKnownPositionAsync: jest.fn(async () => ({
    coords: { latitude: 20.6597, longitude: -103.3496 },
  })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 20.6597, longitude: -103.3496 },
  })),
}));

// `react-native-maps` ships native views that jest-expo cannot render. The mock
// keeps the real component tree shape — a map with markers as children — so a
// test can still assert which pins were drawn and press one, which is the whole
// point of the map in the catalog.
//
// Built with `createElement` rather than JSX because this setup file is `.ts`.
jest.mock("react-native-maps", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");

  const asView =
    (): React.FC<{ children?: React.ReactNode }> =>
    ({ children, ...props }) =>
      createElement(View, props, children);

  return {
    __esModule: true,
    default: asView(),
    Marker: asView(),
    PROVIDER_GOOGLE: "google",
  };
});
