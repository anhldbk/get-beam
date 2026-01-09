const nextJest = require("next/jest");
const createJestConfig = nextJest({
  dir: "./",
});
const customJestConfig = {
  preset: "ts-jest",
  moduleDirectories: ["node_modules", "<rootDir>/"],
  // testEnvironment: "jest-environment-jsdom",
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
module.exports = createJestConfig(customJestConfig);
