// ***********************************************************
// This file configures all Cypress support functionality
// for the IAE Chatbot Mistral project's e2e tests
// ***********************************************************

// Import Cypress commands
import './commands';

// Import cypress-axe for accessibility testing
import 'cypress-axe';

// Preserve cookies and localStorage between tests
Cypress.Cookies.defaults({
  preserve: ['session_id', 'remember_token'],
});

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing the test on uncaught exceptions
  // This is useful when testing error handling in the application
  console.log('Uncaught exception:', err.message);
  return false;
});

// Log failed assertions with more context
Cypress.on('fail', (error, runnable) => {
  // Take a screenshot on assertion failures
  cy.screenshot(`failed-${runnable.title.replace(/\s+/g, '-')}`);
  
  // Log detailed error information
  console.error('Test failed:', {
    title: runnable.title,
    error: error.message,
    stack: error.stack,
  });
  
  // Re-throw the error to fail the test
  throw error;
});

// Custom commands for chatbot testing

// Type and send a message in the chat
Cypress.Commands.add('sendChatMessage', (message) => {
  cy.get('textarea[placeholder*="Posez votre question"]')
    .should('be.visible')
    .clear()
    .type(message);
  
  cy.get('button:has(.lucide-send)')
    .should('be.enabled')
    .click();
  
  // Verify the message appears in the chat
  cy.contains('.whitespace-pre-wrap', message)
    .should('be.visible');
});

// Wait for bot response to appear
Cypress.Commands.add('waitForBotResponse', (timeout = 30000) => {
  // First check if loading indicator appears
  cy.get('.animate-spin', { timeout: 10000 })
    .should('be.visible');
  
  // Then wait for it to disappear, indicating response is complete
  cy.get('.animate-spin', { timeout })
    .should('not.exist');
  
  // Ensure a bot message is visible
  cy.get('.prose-headings\\:text-gray-800')
    .should('be.visible');
});

// Check workflow step status
Cypress.Commands.add('checkWorkflowStep', (stepName, status) => {
  const statusClasses = {
    'pending': 'bg-gray-300',
    'active': 'bg-blue-500',
    'completed': 'bg-green-500'
  };
  
  cy.contains('.text-xs', stepName)
    .parent()
    .find(`div.${statusClasses[status]}`)
    .should('exist');
});

// Check if bot response contains specific text
Cypress.Commands.add('botResponseContains', (text) => {
  cy.get('.prose-headings\\:text-gray-800')
    .should('contain', text);
});

// Check if sources are displayed in the response
Cypress.Commands.add('checkResponseSources', (shouldExist = true) => {
  if (shouldExist) {
    cy.contains('.text-xs.font-semibold', 'Sources :')
      .should('be.visible');
    cy.get('.text-blue-600.hover\\:text-blue-800')
      .should('exist');
  } else {
    cy.contains('.text-xs.font-semibold', 'Sources :')
      .should('not.exist');
  }
});

// Run accessibility audit on the current page
Cypress.Commands.add('runA11yAudit', () => {
  cy.injectAxe();
  cy.checkA11y(null, {
    includedImpacts: ['critical', 'serious'],
    rules: {
      'color-contrast': { enabled: true },
      'label': { enabled: true },
      'aria-roles': { enabled: true }
    }
  }, (violations) => {
    cy.task('log', `${violations.length} accessibility violations found`);
    if (violations.length > 0) {
      cy.task('table', violations);
    }
  });
});

// Before each test
beforeEach(() => {
  // Visit the application
  cy.visit('/');
  
  // Wait for initial bot greeting to appear
  cy.contains("Bonjour ! Je suis l'assistant intelligent de l'IAE Lyon 3")
    .should('be.visible');
  
  // Inject axe-core for accessibility testing
  cy.injectAxe();
  
  // Preserve localStorage between tests
  cy.window().then((win) => {
    win.localStorage.setItem('cypress-testing', 'true');
  });
});

// After each test
afterEach(() => {
  // Run accessibility audit after each test
  cy.runA11yAudit();
  
  // Log test completion
  cy.task('log', 'Test completed');
});
