module.exports = {
  preset: 'ts-jest',
  testEnvironment: "<rootDir>/src/__test-utils__/custom-jest-environment.js",
  testMatch: [
    "**/__tests__/**/*+(spec|test).ts?(x)",
     "**/?(*.)+(spec|test).ts?(x)"
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/__test-utils__/utils/"
  ],
};