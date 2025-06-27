/**
 * @file Unit tests for ConversationService
 * 
 * These tests verify the functionality of the ConversationService class,
 * which provides methods for starting, appending, restarting, and streaming conversations
 * with Mistral AI agents.
 */

import ConversationService from '../conversationService';
import fetchWithRetry from '@utils/fetchWithRetry';
import { AgentCompletionResponse, ConversationStartRequest, ConversationAppendRequest } from '@types/index';

// Mock the fetchWithRetry utility
jest.mock('@utils/fetchWithRetry', () => {
  return jest.fn();
});

describe('ConversationService', () => {
  // Constants for testing
  const API_KEY = 'test-api-key';
  const API_BASE_URL = 'https://test-api.mistral.ai/v1';
  const MOCK_AGENT_ID = 'agent_123456789';
  const MOCK_CONVERSATION_ID = 'conv_123456789';
  
  // Sample API response for testing
  const mockApiResponse = {
    id: MOCK_CONVERSATION_ID,
    object: 'agent.completion',
    created: 1719590400,
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'This is a test response',
          tool_calls: [
            {
              function: {
                name: 'document_library.search',
                arguments: 'https://example.com/document'
              },
              type: 'document_library'
            }
          ]
        },
        finish_reason: 'stop',
        index: 0
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  };
  
  // Sample API response with PDF URL for testing
  const mockApiResponseWithPdf = {
    id: MOCK_CONVERSATION_ID,
    object: 'agent.completion',
    created: 1719590400,
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Here is a PDF document: https://example.com/document.pdf',
          tool_calls: [
            {
              function: {
                name: 'web_search',
                arguments: 'https://example.com/document.pdf'
              },
              type: 'web_search'
            }
          ]
        },
        finish_reason: 'stop',
        index: 0
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  };
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchWithRetry as jest.Mock).mockReset();
  });
  
  describe('constructor', () => {
    it('should initialize with provided API key and base URL', () => {
      const service = new ConversationService(API_KEY, API_BASE_URL);
      expect(service).toBeInstanceOf(ConversationService);
    });
    
    it('should use default base URL if not provided', () => {
      const service = new ConversationService(API_KEY);
      expect(service).toBeInstanceOf(ConversationService);
    });
  });
  
  describe('start', () => {
    it('should successfully start a conversation', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockApiResponse
      });
      
      // Act
      const result = await service.start(request);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }),
          body: expect.any(String)
        })
      );
      
      // Verify the body contains the correct request payload
      const calledBody = JSON.parse((fetchWithRetry as jest.Mock).mock.calls[0][1].body);
      expect(calledBody).toEqual({
        agent_id: MOCK_AGENT_ID,
        messages: [
          {
            role: 'user',
            content: 'Test message'
          }
        ]
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: MOCK_CONVERSATION_ID,
        conversation_id: MOCK_CONVERSATION_ID,
        content: 'This is a test response',
        sources: expect.any(Array),
        usage: expect.any(Object)
      });
      
      // Verify sources are extracted correctly
      expect(result.data.sources).toHaveLength(1);
      expect(result.data.sources[0]).toEqual({
        title: 'document_library.search',
        url: 'https://example.com/document',
        source: 'document_library'
      });
      
      // Verify PDF detection
      expect(result.data.hasPdfUrls).toBe(false);
    });
    
    it('should detect PDF URLs in response content', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Find PDF documents'
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockApiResponseWithPdf
      });
      
      // Act
      const result = await service.start(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.hasPdfUrls).toBe(true);
      expect(result.data.content).toContain('.pdf');
      
      // Verify sources are extracted correctly
      expect(result.data.sources).toHaveLength(1);
      expect(result.data.sources[0].url).toContain('.pdf');
    });
    
    it('should handle API errors when starting a conversation', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      const mockError = new Error('API error');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.start(request);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
    
    it('should handle invalid response format', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      // Response missing the choices array
      const invalidResponse = {
        id: MOCK_CONVERSATION_ID,
        object: 'agent.completion',
        created: 1719590400,
        // No choices array
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: invalidResponse
      });
      
      // Act
      const result = await service.start(request);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Invalid response from');
    });
  });
  
  describe('append', () => {
    it('should successfully append to a conversation', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: MOCK_CONVERSATION_ID,
        inputs: 'Follow-up message'
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockApiResponse
      });
      
      // Act
      const result = await service.append(request);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/agents/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: expect.any(String)
        })
      );
      
      // Verify the body contains the correct request payload
      const calledBody = JSON.parse((fetchWithRetry as jest.Mock).mock.calls[0][1].body);
      expect(calledBody).toEqual({
        agent_id: MOCK_AGENT_ID,
        messages: [
          {
            role: 'user',
            content: 'Follow-up message'
          }
        ]
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: MOCK_CONVERSATION_ID,
        conversation_id: MOCK_CONVERSATION_ID,
        content: 'This is a test response',
        sources: expect.any(Array)
      });
    });
    
    it('should preserve the provided conversation ID', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const customConversationId = 'custom_conv_id';
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: customConversationId,
        inputs: 'Follow-up message'
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockApiResponse
      });
      
      // Act
      const result = await service.append(request);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.conversation_id).toBe(customConversationId);
    });
    
    it('should handle API errors when appending to a conversation', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: MOCK_CONVERSATION_ID,
        inputs: 'Follow-up message'
      };
      
      const mockError = new Error('API error');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.append(request);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
    
    it('should handle exceptions during response processing', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: MOCK_CONVERSATION_ID,
        inputs: 'Follow-up message'
      };
      
      // Force an exception during processing
      (fetchWithRetry as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      
      // Act
      const result = await service.append(request);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Unexpected error');
    });
  });
  
  describe('restart', () => {
    it('should call start method with the provided request', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const restartRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        messageId: 'msg_123',
        agentId: MOCK_AGENT_ID,
        inputs: 'Restart message'
      };
      
      // Mock the start method to return a successful response
      jest.spyOn(service, 'start').mockResolvedValueOnce({
        success: true,
        data: mockApiResponse
      });
      
      // Act
      const result = await service.restart(restartRequest);
      
      // Assert
      expect(service.start).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: restartRequest.agentId,
          inputs: restartRequest.inputs
        }),
        undefined // No options passed in this test
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockApiResponse);
    });
  });
  
  describe('streaming methods', () => {
    it('startStream should throw not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      // Act & Assert
      await expect(service.startStream(request)).rejects.toThrow('Not implemented - Phase 3');
    });
    
    it('appendStream should throw not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: MOCK_CONVERSATION_ID,
        inputs: 'Follow-up message'
      };
      
      // Act & Assert
      await expect(service.appendStream(request)).rejects.toThrow('Not implemented - Phase 3');
    });
  });
  
  describe('conversation management methods', () => {
    it('getConversation should return not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      
      // Act
      const result = await service.getConversation(MOCK_CONVERSATION_ID);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Conversation retrieval not supported with current API - Will be implemented in Phase 3');
    });
    
    it('listConversations should return not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      
      // Act
      const result = await service.listConversations();
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Conversation listing not supported with current API - Will be implemented in Phase 3');
    });
    
    it('deleteConversation should return not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      
      // Act
      const result = await service.deleteConversation(MOCK_CONVERSATION_ID);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Conversation deletion not supported with current API - Will be implemented in Phase 3');
    });
    
    it('submitFunctionResult should return not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      
      // Act
      const result = await service.submitFunctionResult(
        MOCK_CONVERSATION_ID,
        'func_123',
        { result: 'test' }
      );
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Function submission not supported with current API - Will be implemented in Phase 3');
    });
  });
});
