// cypress/e2e/baseline-chatbot.cy.js
/**
 * Baseline E2E tests for IAE Chatbot Mistral
 * 
 * These tests capture the current behavior of the chatbot
 * to ensure no regression during the refactoring process.
 */

describe('IAE Chatbot Mistral - Baseline Tests', () => {
  // Skip API-dependent tests in CI environment
  const skipIfCI = () => {
    if (Cypress.env('isCI')) {
      cy.log('Skipping API-dependent test in CI environment');
      return true;
    }
    return false;
  };

  beforeEach(() => {
    // Set up environment for tests
    cy.intercept('POST', '**/agents', (req) => {
      // Allow the request to go through but log it
      cy.log('Agent creation request intercepted');
    }).as('agentCreation');

    cy.intercept('POST', '**/agents/completions', (req) => {
      // Allow the request to go through but log it
      cy.log('Agent completion request intercepted');
    }).as('agentCompletion');

    // Visit the app
    cy.visit('/');
    
    // Ensure the app is fully loaded
    cy.contains("Bonjour ! Je suis l'assistant intelligent de l'IAE Lyon 3")
      .should('be.visible');
  });

  describe('1. Initial Page Load and UI Elements', () => {
    it('should display the header with correct title and description', () => {
      cy.get('h1')
        .should('contain.text', 'Assistant IAE Lyon 3');
      
      cy.contains('p', 'Intelligence artificielle • Recherche web spécialisée')
        .should('be.visible');
      
      cy.contains('span', 'Powered by Mistral AI')
        .should('be.visible');
    });

    it('should display the initial bot greeting message', () => {
      cy.contains("Bonjour ! Je suis l'assistant intelligent de l'IAE Lyon 3")
        .should('be.visible');
    });

    it('should display chat input area with send button', () => {
      cy.get('textarea[placeholder*="Posez votre question"]')
        .should('be.visible')
        .should('not.be.disabled');
      
      cy.get('button:has(.lucide-send)')
        .should('be.visible')
        .should('be.disabled'); // Initially disabled when input is empty
    });

    it('should display the Mistral AI integration section', () => {
      cy.contains('h3', '🤖 Intégration Mistral AI activée')
        .should('be.visible');
      
      cy.contains('p', 'Agent spécialisé')
        .should('be.visible');
      
      cy.contains('p', 'Recherche ciblée')
        .should('be.visible');
      
      cy.contains('p', 'Sources vérifiées')
        .should('be.visible');
    });

    it('should display the logs section', () => {
      cy.contains('h3', '📋 Logs API Workflow Agentic Mistral')
        .should('be.visible');
    });
  });

  describe('2. Basic Chat Interaction', () => {
    it('should enable send button when text is entered', () => {
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type('Test message');
      
      cy.get('button:has(.lucide-send)')
        .should('be.enabled');
    });

    it('should display user message in chat when sent', () => {
      const testMessage = 'Test message';
      
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type(testMessage);
      
      cy.get('button:has(.lucide-send)')
        .click();
      
      cy.contains('.whitespace-pre-wrap', testMessage)
        .should('be.visible');
    });

    it('should show loading indicator when waiting for response', { defaultCommandTimeout: 10000 }, () => {
      if (skipIfCI()) return;
      
      const testMessage = 'Quels sont les masters disponibles?';
      
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type(testMessage);
      
      cy.get('button:has(.lucide-send)')
        .click();
      
      // Check loading indicator appears
      cy.get('.animate-spin')
        .should('be.visible');
    });

    it('should receive and display bot response', { defaultCommandTimeout: 60000 }, () => {
      if (skipIfCI()) return;
      
      const testMessage = 'Quels sont les masters disponibles?';
      
      cy.sendMessageAndWaitForResponse(testMessage);
      
      // Verify bot response appears
      cy.get('.prose-headings\\:text-gray-800')
        .should('be.visible')
        .should('not.be.empty');
    });
  });

  describe('3. Workflow Indicators and Progress', () => {
    it('should display workflow steps during processing', { defaultCommandTimeout: 15000 }, () => {
      if (skipIfCI()) return;
      
      const testMessage = 'Quels sont les masters disponibles?';
      
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type(testMessage);
      
      cy.get('button:has(.lucide-send)')
        .click();
      
      // Check loading state appears with workflow steps
      cy.contains('.text-sm', 'Exécution du workflow agentic')
        .should('be.visible');
      
      // Check all three workflow steps are displayed
      cy.contains('.text-xs', 'Document Library')
        .should('be.visible');
      
      cy.contains('.text-xs', 'Websearch IAE')
        .should('be.visible');
      
      cy.contains('.text-xs', 'Document Q&A')
        .should('be.visible');
    });

    it('should update workflow step status during processing', { defaultCommandTimeout: 30000 }, () => {
      if (skipIfCI()) return;
      
      const testMessage = 'Quels sont les masters disponibles?';
      
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type(testMessage);
      
      cy.get('button:has(.lucide-send)')
        .click();
      
      // Check Document Library step becomes active
      cy.contains('.text-xs', 'Document Library')
        .parent()
        .find('.bg-blue-500, .animate-pulse')
        .should('exist');
    });
  });

  describe('4. Agent Workflow Execution Path', () => {
    it('should display workflow path in bot response', { defaultCommandTimeout: 60000 }, () => {
      if (skipIfCI()) return;
      
      const testMessage = 'Quels sont les masters disponibles?';
      
      cy.sendMessageAndWaitForResponse(testMessage);
      
      // Check workflow path section appears
      cy.contains('.text-xs.font-semibold', 'Workflow exécuté :')
        .should('exist');
      
      // Check at least one step is displayed in the path
      cy.get('.text-xs.bg-blue-100')
        .should('exist');
    });
  });

  describe('5. Error Handling Scenarios', () => {
    it('should handle empty messages gracefully', () => {
      // Try to send an empty message
      cy.get('button:has(.lucide-send)')
        .should('be.disabled');
      
      // Try with only spaces
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type('   ');
      
      cy.get('button:has(.lucide-send)')
        .should('be.disabled');
    });

    // This test simulates API errors by intercepting and modifying responses
    it('should display error message when API fails', { defaultCommandTimeout: 30000 }, () => {
      // Intercept agent completions and force an error
      cy.intercept('POST', '**/agents/completions', {
        statusCode: 500,
        body: { error: 'Test error' }
      }).as('forcedError');
      
      const testMessage = 'This should trigger an error';
      
      cy.get('textarea[placeholder*="Posez votre question"]')
        .type(testMessage);
      
      cy.get('button:has(.lucide-send)')
        .click();
      
      // Wait for the intercepted request
      cy.wait('@forcedError');
      
      // Check error message appears
      cy.contains('Désolé, je rencontre actuellement des difficultés techniques')
        .should('be.visible');
    });
  });

  describe('6. Accessibility Compliance', () => {
    it('should have proper keyboard navigation', () => {
      // Tab to the textarea
      cy.get('body').tab();
      cy.focused()
        .should('have.attr', 'placeholder')
        .and('include', 'Posez votre question');
      
      // Type some text to enable the send button
      cy.focused().type('Hello');
      
      // Tab to the send button
      cy.focused().tab();
      cy.focused()
        .should('have.class', 'bg-blue-600')
        .should('have.descendants', '.lucide-send');
    });

    it('should pass basic accessibility checks', () => {
      cy.injectAxe();
      
      // Test the main page with basic a11y rules
      cy.checkA11y(null, {
        includedImpacts: ['critical', 'serious'],
        rules: {
          'color-contrast': { enabled: true },
          'label': { enabled: true },
          'aria-roles': { enabled: true }
        }
      });
    });
  });

  describe('7. API Logs Display', () => {
    it('should display API logs after receiving response', { defaultCommandTimeout: 60000 }, () => {
      if (skipIfCI()) return;
      
      const testMessage = 'Quels sont les masters disponibles?';
      
      cy.sendMessageAndWaitForResponse(testMessage);
      
      // Check logs section
      cy.contains('h3', '📋 Logs API Workflow Agentic Mistral')
        .should('be.visible');
      
      // Check conversation ID appears
      cy.contains('h4', '📞 Conversation ID')
        .should('be.visible');
      
      // Check for either tool execution or message output sections
      cy.get('.bg-yellow-50.rounded-lg, .bg-green-50.rounded-lg')
        .should('exist');
      
      // Check for JSON display
      cy.contains('h4', '🔍 JSON Complet')
        .should('be.visible');
      
      cy.get('.bg-gray-900.rounded')
        .should('exist');
    });
  });

  describe('8. Sources and Citations', () => {
    it('should display sources in bot responses when available', { defaultCommandTimeout: 60000 }, () => {
      if (skipIfCI()) return;
      
      // Use a query likely to return sources
      const testMessage = 'Quels sont les masters en management?';
      
      cy.sendMessageAndWaitForResponse(testMessage);
      
      // Check if sources section appears
      cy.contains('.text-xs.font-semibold', 'Sources :')
        .should('exist');
      
      // Check for source links
      cy.get('.text-blue-600.hover\\:text-blue-800')
        .should('exist');
    });
  });

  describe('9. Complex Interaction Flows', () => {
    it('should handle multi-turn conversation', { defaultCommandTimeout: 120000 }, () => {
      if (skipIfCI()) return;
      
      // First question
      cy.sendMessageAndWaitForResponse('Quels sont les masters disponibles?');
      
      // Follow-up question
      cy.sendMessageAndWaitForResponse('Et quelles sont les conditions d\'admission?');
      
      // Verify both user messages and bot responses are visible
      cy.get('.whitespace-pre-wrap')
        .should('have.length.at.least', 4); // 2 user messages + 2 bot responses
    });

    it('should detect and handle PDF references correctly', { defaultCommandTimeout: 60000 }, () => {
      if (skipIfCI()) return;
      
      // Query likely to return PDF documents
      const testMessage = 'Où puis-je trouver la brochure des programmes?';
      
      cy.sendMessageAndWaitForResponse(testMessage);
      
      // Check if workflow path includes Document Q&A (only if PDFs were found)
      cy.get('.text-xs.font-semibold')
        .contains('Workflow exécuté :')
        .parent()
        .then($el => {
          const workflowText = $el.text();
          
          // If workflow includes Document Q&A, check for PDF analysis
          if (workflowText.includes('Document Q&A')) {
            cy.contains('Analyse approfondie des documents')
              .should('exist');
          }
        });
    });
  });
});
