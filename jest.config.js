/**
 * Jest Configuration for IAE Chatbot Mistral
 * 
 * This configuration supports:
 * - TypeScript testing with ts-jest
 * - Path mapping from tsconfig.json
 * - Proper test coverage settings (90% threshold)
 * - Exclusion of existing App.test.js and Cypress files
 */

module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Explicitly set the test environment to JSDOM for browser-like testing
  testEnvironment: 'jsdom',

  // Files that need to run **before** the test framework is installed
  // (polyfills, global mocks, etc.)
  setupFiles: [
    '<rootDir>/jest.setup.js'      // ensure global objects are available
  ],
  
  // File extensions to consider for tests
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform TypeScript files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Path mapping to match tsconfig.json paths
  moduleNameMapper: {
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1'
  },
  
  // Setup files for tests
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx,js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{ts,tsx,js,jsx}'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/cypress/',
    '/build/',
    '/dist/',
    '/coverage/',
    '/src/App.test.js'  // Exclude existing App.test.js
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/index.{ts,tsx,js,jsx}',
    '!src/reportWebVitals.{ts,tsx,js,jsx}',
    '!src/setupTests.{ts,tsx,js,jsx}',
    '!src/App.{ts,tsx,js,jsx}',  // Exclude existing App.js until migration
    '!src/App.test.js',
    '!src/**/*.stories.{ts,tsx,js,jsx}',
    '!src/**/__mocks__/**',
    '!src/**/__tests__/**'
  ],
  
  // Coverage thresholds as per PRD (90%)
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    }
  },
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'clover'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Maximum number of workers
  maxWorkers: '50%',
  
  // Verbose output
  verbose: true
};
