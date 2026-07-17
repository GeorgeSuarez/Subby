/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/**/*.test.(ts|tsx|js)',
    '**/?(*.)+(test|spec).(ts|tsx|js)',
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/app/**'],
};