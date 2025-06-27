/**
 * @file Unit tests for AgentService
 * 
 * These tests verify the functionality of the AgentService class,
 * which provides methods for creating, updating, listing, and managing Mistral AI agents.
 */

import AgentService from '../agentService';
import fetchWithRetry from '@utils/fetchWithRetry';
import { Agent, AgentConfig } from '@types/index';

// Mock the fetchWithRetry utility
jest.mock('@utils/fetchWithRetry', () => {
  return jest.fn();
});

describe('AgentService', () => {
  // Constants for testing
  const API_KEY = 'test-api-key';
  const API_BASE_URL = 'https://test-api.mistral.ai/v1';
  const MOCK_AGENT_ID = 'agent_123456789';
  
  // Sample agent configuration for testing
  const mockAgentConfig: AgentConfig = {
    model: 'mistral-medium-latest',
    name: 'Test Agent',
    description: 'A test agent',
    instructions: 'Test instructions',
    tools: [{ type: 'document_library', document_library: { library_ids: ['lib_123'] } }],
    temperature: 0.3,
    top_p: 0.95
  };
  
  // Sample agent response from API
  const mockAgentResponse: Agent = {
    id: MOCK_AGENT_ID,
    object: 'agent',
    created_at: 1719590400,
    name: 'Test Agent',
    description: 'A test agent',
    model: 'mistral-medium-latest',
    instructions: 'Test instructions',
    tools: [{ type: 'document_library', document_library: { library_ids: ['lib_123'] } }],
    temperature: 0.3,
    top_p: 0.95,
    handoffs: []
  };
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchWithRetry as jest.Mock).mockReset();
  });
  
  describe('constructor', () => {
    it('should initialize with provided API key and base URL', () => {
      const service = new AgentService(API_KEY, API_BASE_URL);
      expect(service).toBeInstanceOf(AgentService);
    });
    
    it('should use default base URL if not provided', () => {
      const service = new AgentService(API_KEY);
      expect(service).toBeInstanceOf(AgentService);
    });
  });
  
  describe('createAgent', () => {
    it('should successfully create an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAgentResponse
      });
      
      // Act
      const result = await service.createAgent(mockAgentConfig);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }),
          body: expect.any(String)
        })
      );
      
      // Verify the body contains the correct agent configuration
      const calledBody = JSON.parse((fetchWithRetry as jest.Mock).mock.calls[0][1].body);
      expect(calledBody).toMatchObject({
        model: mockAgentConfig.model,
        name: mockAgentConfig.name,
        description: mockAgentConfig.description,
        instructions: mockAgentConfig.instructions,
        tools: mockAgentConfig.tools,
        completion_args: {
          temperature: mockAgentConfig.temperature,
          top_p: mockAgentConfig.top_p
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAgentResponse);
    });
    
    it('should handle API errors when creating an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('API error');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.createAgent(mockAgentConfig);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('updateAgent', () => {
    it('should successfully update an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const updateConfig = { name: 'Updated Agent Name' };
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { ...mockAgentResponse, name: 'Updated Agent Name' }
      });
      
      // Act
      const result = await service.updateAgent(MOCK_AGENT_ID, updateConfig);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${MOCK_AGENT_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.any(Object),
          body: JSON.stringify(updateConfig)
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Agent Name');
    });
    
    it('should format the entire config when replace option is true', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAgentResponse
      });
      
      // Act
      await service.updateAgent(MOCK_AGENT_ID, mockAgentConfig, { replace: true });
      
      // Assert
      const calledBody = JSON.parse((fetchWithRetry as jest.Mock).mock.calls[0][1].body);
      expect(calledBody).toHaveProperty('completion_args');
      expect(calledBody.completion_args).toEqual({
        temperature: mockAgentConfig.temperature,
        top_p: mockAgentConfig.top_p
      });
    });
    
    it('should handle API errors when updating an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Update failed');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.updateAgent(MOCK_AGENT_ID, { name: 'New Name' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('getAgent', () => {
    it('should successfully retrieve an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAgentResponse
      });
      
      // Act
      const result = await service.getAgent(MOCK_AGENT_ID);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${MOCK_AGENT_ID}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object)
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAgentResponse);
    });
    
    it('should handle API errors when retrieving an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Agent not found');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.getAgent(MOCK_AGENT_ID);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('listAgents', () => {
    it('should successfully list agents', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockAgents = [mockAgentResponse, { ...mockAgentResponse, id: 'agent_987654321' }];
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAgents
      });
      
      // Act
      const result = await service.listAgents();
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object)
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAgents);
      expect(result.data.length).toBe(2);
    });
    
    it('should include query parameters when provided', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: [mockAgentResponse]
      });
      
      // Act
      await service.listAgents({
        limit: 10,
        offset: 5,
        name: 'Test'
      });
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents?limit=10&offset=5&name=Test`,
        expect.any(Object)
      );
    });
    
    it('should handle API errors when listing agents', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Failed to list agents');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.listAgents();
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('deleteAgent', () => {
    it('should successfully delete an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: undefined
      });
      
      // Act
      const result = await service.deleteAgent(MOCK_AGENT_ID);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${MOCK_AGENT_ID}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.any(Object)
        })
      );
      
      expect(result.success).toBe(true);
    });
    
    it('should handle API errors when deleting an agent', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Failed to delete agent');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.deleteAgent(MOCK_AGENT_ID);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('configureHandoffs', () => {
    it('should successfully configure handoffs between agents', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const targetAgentIds = ['agent_target1', 'agent_target2'];
      const updatedAgent = {
        ...mockAgentResponse,
        handoffs: targetAgentIds
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: updatedAgent
      });
      
      // Act
      const result = await service.configureHandoffs(MOCK_AGENT_ID, targetAgentIds);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${MOCK_AGENT_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.any(Object),
          body: JSON.stringify({ handoffs: targetAgentIds })
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.data.handoffs).toEqual(targetAgentIds);
    });
    
    it('should handle API errors when configuring handoffs', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Failed to configure handoffs');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.configureHandoffs(MOCK_AGENT_ID, ['target_id']);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('agentExists', () => {
    it('should return true if agent exists', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAgentResponse
      });
      
      // Act
      const result = await service.agentExists(MOCK_AGENT_ID);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/${MOCK_AGENT_ID}`,
        expect.any(Object)
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });
    
    it('should return false if agent does not exist (404)', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: new Error('HTTP error 404: Agent not found')
      });
      
      // Act
      const result = await service.agentExists(MOCK_AGENT_ID);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });
    
    it('should propagate other errors', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Network error');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.agentExists(MOCK_AGENT_ID);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('createAllAgents', () => {
    it('should successfully create all agents', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockConfigs = {
        documentLibrary: { ...mockAgentConfig, name: 'Document Library Agent' },
        websearch: { ...mockAgentConfig, name: 'Websearch Agent' }
      };
      
      const mockResponses = {
        documentLibrary: { ...mockAgentResponse, id: 'agent_doc', name: 'Document Library Agent' },
        websearch: { ...mockAgentResponse, id: 'agent_web', name: 'Websearch Agent' }
      };
      
      // Mock createAgent to return success for each agent
      (fetchWithRetry as jest.Mock)
        .mockResolvedValueOnce({ success: true, data: mockResponses.documentLibrary })
        .mockResolvedValueOnce({ success: true, data: mockResponses.websearch });
      
      // Act
      const result = await service.createAllAgents(mockConfigs);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponses);
    });
    
    it('should handle errors when creating agents', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockConfigs = {
        documentLibrary: mockAgentConfig,
        websearch: mockAgentConfig
      };
      
      // Mock first createAgent to fail
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: new Error('Failed to create agent')
      });
      
      // Act
      const result = await service.createAllAgents(mockConfigs);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Failed to create agent documentLibrary');
    });
  });
  
  describe('testConnectivity', () => {
    it('should successfully test API connectivity', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { data: [{ id: 'model_1', name: 'Test Model' }] }
      });
      
      // Act
      const result = await service.testConnectivity();
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/models`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object)
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });
    
    it('should handle API errors when testing connectivity', async () => {
      // Arrange
      const service = new AgentService(API_KEY, API_BASE_URL);
      const mockError = new Error('Connection failed');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.testConnectivity();
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
});
