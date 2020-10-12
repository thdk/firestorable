module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: [
    "**/__tests__/**/*+(spec|test).ts?(x)",
     "**/?(*.)+(spec|test).ts?(x)"
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/__tests__/utils/"
  ],
};