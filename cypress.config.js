const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        }
      });
      
      // Determine if we're running in CI
      const isCI = process.env.CI === 'true';
      
      // Update configuration based on environment
      config.env = {
        ...config.env,
        isCI
      };
      
      // Adjust retry attempts based on environment
      config.retries = {
        runMode: isCI ? 2 : 0,
        openMode: 0
      };
      
      return config;
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 30000, // 30 seconds for AI API calls
    requestTimeout: 30000,
    responseTimeout: 60000, // Longer timeout for API responses
    pageLoadTimeout: 90000, // Some breathing room for initial page load
    
    // Video and screenshot settings
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    
    // Test files pattern
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',
    
    // Accessibility testing support
    includeShadowDom: true,
    
    // Preserve state between tests for faster execution
    experimentalMemoryManagement: true,
    
    // Better error messages
    experimentalStudio: true
  }
});
