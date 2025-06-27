// ***********************************************
// This file defines custom commands for the
// IAE Chatbot Mistral project's Cypress tests
// ***********************************************

// Import cypress-axe for accessibility testing
import 'cypress-axe';

// -- Chat Interaction Commands --

/**
 * Send a message in the chatbot interface
 * @param {string} message - The message to send
 */
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

/**
 * Wait for the bot to respond to a message
 * @param {number} timeout - Maximum time to wait in milliseconds
 */
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

/**
 * Send a message and wait for the bot to respond
 * @param {string} message - The message to send
 * @param {number} timeout - Maximum time to wait for response
 */
Cypress.Commands.add('sendMessageAndWaitForResponse', (message, timeout = 30000) => {
  cy.sendChatMessage(message);
  cy.waitForBotResponse(timeout);
});

// -- Workflow Verification Commands --

/**
 * Check the status of a specific workflow step
 * @param {string} stepName - Name of the step (e.g., "Document Library")
 * @param {string} status - Expected status: "pending", "active", or "completed"
 */
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

/**
 * Verify the complete workflow execution path
 * @param {Array<string>} path - Array of step names in execution order
 */
Cypress.Commands.add('verifyWorkflowPath', (path) => {
  cy.contains('.text-xs.font-semibold', 'Workflow exécuté :')
    .should('be.visible');
  
  path.forEach((step, index) => {
    cy.contains('.text-xs.bg-blue-100', step)
      .should('be.visible');
    
    // Check for arrow between steps (except after last step)
    if (index < path.length - 1) {
      cy.contains('.text-xs.bg-blue-100', step)
        .parent()
        .find('.text-gray-400.text-xs')
        .should('be.visible')
        .should('contain', '→');
    }
  });
});

// -- Response Content Validation Commands --

/**
 * Check if bot response contains specific text
 * @param {string} text - Text to look for in the response
 */
Cypress.Commands.add('botResponseContains', (text) => {
  cy.get('.prose-headings\\:text-gray-800')
    .should('contain', text);
});

/**
 * Check if sources are displayed in the response
 * @param {boolean} shouldExist - Whether sources should exist
 */
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

/**
 * Verify the presence of PDF links in the response
 * @param {boolean} shouldExist - Whether PDF links should exist
 */
Cypress.Commands.add('checkPdfLinks', (shouldExist = true) => {
  if (shouldExist) {
    cy.get('.text-blue-600.hover\\:text-blue-800')
      .should('exist')
      .then($links => {
        const hasPdfLink = Array.from($links).some(link => 
          link.textContent.toLowerCase().includes('.pdf'));
        expect(hasPdfLink).to.be.true;
      });
  }
});

/**
 * Check if the API logs section contains expected data
 */
Cypress.Commands.add('checkApiLogs', () => {
  cy.contains('h3', 'Logs API Workflow Agentic Mistral')
    .should('be.visible');
  
  cy.get('.bg-blue-50.rounded-lg')
    .should('be.visible')
    .contains('Conversation ID')
    .should('be.visible');
  
  // Check for tool executions
  cy.get('.bg-yellow-50.rounded-lg, .bg-green-50.rounded-lg')
    .should('exist');
});

// -- Accessibility Testing Commands --

/**
 * Run accessibility audit on the current page
 */
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

/**
 * Check specific accessibility requirements for chat interface
 */
Cypress.Commands.add('checkChatAccessibility', () => {
  // Check that chat input has proper label/placeholder
  cy.get('textarea[placeholder*="Posez votre question"]')
    .should('have.attr', 'placeholder');
  
  // Check that send button has proper aria attributes
  cy.get('button:has(.lucide-send)')
    .should('not.have.attr', 'disabled');
  
  // Check contrast of key elements
  cy.runA11yAudit();
});

// -- Test Data Management Commands --

/**
 * Load test queries from fixtures
 * @param {string} fixturePath - Path to the fixture file
 */
Cypress.Commands.add('loadTestQueries', (fixturePath = 'testQueries.json') => {
  cy.fixture(fixturePath).then((data) => {
    cy.wrap(data).as('testQueries');
  });
});

/**
 * Set up mock API responses for testing without real API calls
 * @param {boolean} mockApiCalls - Whether to mock API calls
 */
Cypress.Commands.add('setupApiMocks', (mockApiCalls = true) => {
  if (mockApiCalls) {
    cy.intercept('POST', '**/agents/completions', { fixture: 'mockAgentResponse.json' }).as('agentCompletion');
    cy.intercept('GET', '**/models', { fixture: 'mockModels.json' }).as('getModels');
    cy.intercept('POST', '**/agents', { fixture: 'mockAgentCreation.json' }).as('createAgent');
  }
});
