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
  transformIgnorePatterns: [
    "node_modules/(?!.*(react-native|@react-native|expo|@expo|zustand).*)",
  ],
};
