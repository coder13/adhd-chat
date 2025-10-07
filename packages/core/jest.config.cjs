module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!**/*.d.ts', '!**/node_modules/**'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transformIgnorePatterns: ['node_modules/(?!(matrix-js-sdk)/)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
