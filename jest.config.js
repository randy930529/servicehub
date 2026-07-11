const expoPreset = require("jest-expo/jest-preset");
const jsTransformer = expoPreset.transform["\\.[jt]sx?$"];

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["./jest.setup.ts"],
  // The backend (server/) has its own test runner (node:test); keep it out of
  // the app's Jest run.
  testPathIgnorePatterns: ["/node_modules/", "/server/"],
  modulePathIgnorePatterns: ["/server/"],
  moduleNameMapper: {
    "\\.css$": "<rootDir>/__mocks__/fileMock.js",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    ...expoPreset.transform,
    "\\.mjs$": jsTransformer,
  },
  transformIgnorePatterns: [
    "<rootDir>/node_modules/.pnpm/(?!(?:react-native(?:-.+)?|@react-native\\+[^@]+|expo(?:-.+)?|@expo\\+[^@]+|zustand|msw|rettime|until-async|@open-draft\\+[^@]+|@bundled-es-modules\\+[^@]+|strict-event-emitter|outvariant)@)",
    "node_modules/(?!.pnpm|react-native|react-native-.+|@react-native|expo|expo-.+|@expo|zustand|msw|rettime|until-async|@open-draft|@bundled-es-modules|strict-event-emitter|outvariant)",
  ],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  testEnvironmentOptions: {
    // MSW recommends clearing RN custom export conditions so Jest resolves CJS builds.
    customExportConditions: [""],
  },
  testEnvironment: "jest-fixed-jsdom",
};
