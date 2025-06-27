/**
 * @file Unit tests for AgentService
 * 
 * Tests the AgentService class methods for creating, updating, and managing agents.
 */

import { AgentService } from '../mistral/agentService';
import fetchWithRetry from '@utils/fetchWithRetry';
import { Agent, AgentConfig, Result } from '@types/index';

// Mock fetchWithRetry
jest.mock('@utils/fetchWithRetry', () => {
  return jest.fn();
});

describe('AgentService', () => {
  // Test constants
  const API_KEY = 'test-api-key';
  const API_BASE_URL = 'https://api.mistral.ai/v1';
  const AGENT_ID = 'agent_123456789';
  
  // Sample agent configuration
  const sampleAgentConfig: AgentConfig = {
    model: 'mistral-medium-latest',
    name: 'Test Agent',
    description: 'Test agent description',
    instructions: 'Test instructions',
    tools: [{ type: 'document_library', document_library: { library_ids: ['lib_123'] } }],
    temperature: 0.3,
    top_p: 0.95
  };
  
  // Sample agent response
  const sampleAgentResponse: Agent = {
    id: AGENT_ID,
    object: 'agent',
    created_at: 1625097600,
    model: 'mistral-medium-latest',
    name: 'Test Agent',
    description: 'Test agent description',
    instructions: 'Test instructions',
    tools: [{ type: 'document_library', document_library: { library_ids: ['lib_123'] } }],
    temperature: 0.3,
    top_p: 0.95,
    handoffs: []
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchWithRetry as jest.Mock).mockImplementation(() => ({
      success: true,
      data: sampleAgentResponse
    }));
  });

  // Create a new AgentService instance for each test
  const agentService = new AgentService(API_KEY, API_BASE_URL);

  describe('createAgent', () => {
    it('should create an agent successfully', async () => {
      // Call the method
      const result = await agentService.createAgent(sampleAgentConfig);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleAgentResponse);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'iae-chatbot/1.0 (+https://iae.univ-lyon3.fr)'
          },
          body: JSON.stringify({
            model: sampleAgentConfig.model,
            name: sampleAgentConfig.name,
            description: sampleAgentConfig.description,
            instructions: sampleAgentConfig.instructions,
            tools: sampleAgentConfig.tools,
            handoffs: [],
            completion_args: {
              temperature: sampleAgentConfig.temperature,
              top_p: sampleAgentConfig.top_p
            }
          })
        }
      );
    });

    it('should handle API errors when creating an agent', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.createAgent(sampleAgentConfig);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });

    it('should use custom API base URL when provided', async () => {
      // Custom API base URL
      const customBaseUrl = 'https://custom-api.example.com';

      // Call the method with custom options
      await agentService.createAgent(sampleAgentConfig, { apiBaseUrl: customBaseUrl });

      // Verify fetchWithRetry was called with the custom base URL
      expect(fetchWithRetry).toHaveBeenCalledWith(
        expect.stringContaining(customBaseUrl),
        expect.any(Object)
      );
    });
  });

  describe('updateAgent', () => {
    it('should update an agent successfully', async () => {
      // Updates to apply
      const updates = {
        name: 'Updated Agent',
        description: 'Updated description'
      };

      // Call the method
      const result = await agentService.updateAgent(AGENT_ID, updates);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleAgentResponse);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${AGENT_ID}`,
        {
          method: 'PATCH',
          headers: expect.any(Object),
          body: JSON.stringify(updates)
        }
      );
    });

    it('should replace the entire agent when replace=true', async () => {
      // Call the method with replace=true
      await agentService.updateAgent(AGENT_ID, sampleAgentConfig, { replace: true });

      // Verify fetchWithRetry was called with the full formatted config
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${AGENT_ID}`,
        {
          method: 'PATCH',
          headers: expect.any(Object),
          body: expect.stringContaining('"model"')
        }
      );
    });

    it('should handle API errors when updating an agent', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.updateAgent(AGENT_ID, { name: 'Updated Agent' });

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });

  describe('getAgent', () => {
    it('should get an agent successfully', async () => {
      // Call the method
      const result = await agentService.getAgent(AGENT_ID);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleAgentResponse);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${AGENT_ID}`,
        {
          method: 'GET',
          headers: expect.any(Object)
        }
      );
    });

    it('should handle API errors when getting an agent', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.getAgent(AGENT_ID);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });

  describe('listAgents', () => {
    it('should list agents successfully', async () => {
      // Mock a successful response with an array of agents
      const agentsArray = [sampleAgentResponse, { ...sampleAgentResponse, id: 'agent_987654321' }];
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: true,
        data: agentsArray
      }));

      // Call the method
      const result = await agentService.listAgents();

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toEqual(agentsArray);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents`,
        {
          method: 'GET',
          headers: expect.any(Object)
        }
      );
    });

    it('should include query parameters when provided', async () => {
      // Call the method with options
      await agentService.listAgents({
        limit: 10,
        offset: 5,
        name: 'Test'
      });

      // Verify fetchWithRetry was called with the query parameters
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents?limit=10&offset=5&name=Test`,
        expect.any(Object)
      );
    });

    it('should handle API errors when listing agents', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.listAgents();

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });

  describe('deleteAgent', () => {
    it('should delete an agent successfully', async () => {
      // Mock a successful void response
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: true,
        data: undefined
      }));

      // Call the method
      const result = await agentService.deleteAgent(AGENT_ID);

      // Verify the result
      expect(result.success).toBe(true);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${AGENT_ID}`,
        {
          method: 'DELETE',
          headers: expect.any(Object)
        }
      );
    });

    it('should handle API errors when deleting an agent', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.deleteAgent(AGENT_ID);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });

  describe('configureHandoffs', () => {
    it('should configure handoffs successfully', async () => {
      // Target agent IDs
      const targetAgentIds = ['agent_target1', 'agent_target2'];

      // Call the method
      const result = await agentService.configureHandoffs(AGENT_ID, targetAgentIds);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleAgentResponse);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${AGENT_ID}`,
        {
          method: 'PATCH',
          headers: expect.any(Object),
          body: JSON.stringify({ handoffs: targetAgentIds })
        }
      );
    });

    it('should handle API errors when configuring handoffs', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.configureHandoffs(AGENT_ID, ['agent_target']);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });

  describe('agentExists', () => {
    it('should return true when agent exists', async () => {
      // Call the method
      const result = await agentService.agentExists(AGENT_ID);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should return false when agent does not exist', async () => {
      // Mock a 404 error
      const error = new Error('HTTP error 404: Not Found');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.agentExists('nonexistent_agent');

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should propagate other errors', async () => {
      // Mock a non-404 error
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.agentExists(AGENT_ID);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });

  describe('createAllAgents', () => {
    it('should create all agents successfully', async () => {
      // Mock createAgent to return success for each call
      const createAgentSpy = jest.spyOn(agentService, 'createAgent').mockImplementation(
        async (config) => ({
          success: true,
          data: { ...sampleAgentResponse, name: config.name }
        })
      );

      // Agent configs
      const agentConfigs = {
        documentLibrary: { ...sampleAgentConfig, name: 'Document Library' },
        websearch: { ...sampleAgentConfig, name: 'Websearch' }
      };

      // Call the method
      const result = await agentService.createAllAgents(agentConfigs);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        documentLibrary: { ...sampleAgentResponse, name: 'Document Library' },
        websearch: { ...sampleAgentResponse, name: 'Websearch' }
      });

      // Verify createAgent was called for each config
      expect(createAgentSpy).toHaveBeenCalledTimes(2);
      expect(createAgentSpy).toHaveBeenCalledWith(agentConfigs.documentLibrary, undefined);
      expect(createAgentSpy).toHaveBeenCalledWith(agentConfigs.websearch, undefined);

      // Restore the original implementation
      createAgentSpy.mockRestore();
    });

    it('should handle errors when creating agents', async () => {
      // Mock createAgent to fail for one agent
      const createAgentSpy = jest.spyOn(agentService, 'createAgent').mockImplementation(
        async (config) => {
          if (config.name === 'Websearch') {
            return {
              success: false,
              error: new Error('Failed to create Websearch agent')
            };
          }
          return {
            success: true,
            data: { ...sampleAgentResponse, name: config.name }
          };
        }
      );

      // Agent configs
      const agentConfigs = {
        documentLibrary: { ...sampleAgentConfig, name: 'Document Library' },
        websearch: { ...sampleAgentConfig, name: 'Websearch' }
      };

      // Call the method
      const result = await agentService.createAllAgents(agentConfigs);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Failed to create agent websearch');

      // Restore the original implementation
      createAgentSpy.mockRestore();
    });
  });

  describe('testConnectivity', () => {
    it('should test connectivity successfully', async () => {
      // Mock a successful response for the models endpoint
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: true,
        data: { data: ['model1', 'model2'] }
      }));

      // Call the method
      const result = await agentService.testConnectivity();

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);

      // Verify fetchWithRetry was called correctly
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/models`,
        {
          method: 'GET',
          headers: expect.any(Object)
        }
      );
    });

    it('should handle API errors when testing connectivity', async () => {
      // Mock a failed response
      const error = new Error('API Error');
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => ({
        success: false,
        error
      }));

      // Call the method
      const result = await agentService.testConnectivity();

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.error).toEqual(error);
    });
  });
});
