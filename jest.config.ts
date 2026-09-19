import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  // pokemon-restock/ is a separate app with its own jest config and its own
  // @/* root; run it with `npm test` from inside that directory.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/pokemon-restock/"],
};

export default createJestConfig(config);
