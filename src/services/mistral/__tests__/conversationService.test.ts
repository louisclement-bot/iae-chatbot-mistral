/**
 * @file Unit tests for ConversationService
 * 
 * These tests verify the functionality of the ConversationService class,
 * which provides methods for starting, appending, restarting, and streaming conversations
 * with Mistral AI agents.
 */

import ConversationService from '../conversationService';
import fetchWithRetry from '@utils/fetchWithRetry';
import { 
  AgentCompletionResponse, 
  ConversationStartRequest, 
  ConversationAppendRequest, 
  ConversationRestartRequest,
  StreamEvent, 
  StreamEventType 
} from '@types/index';

// Mock the fetchWithRetry utility
jest.mock('@utils/fetchWithRetry', () => {
  return jest.fn();
});

// Helper to create a mock ReadableStream for testing SSE
const createMockReadableStream = (events: string[]): ReadableStream<Uint8Array> => {
  let index = 0;
  return new ReadableStream({
    start(controller) {
      function push() {
        if (index < events.length) {
          controller.enqueue(new TextEncoder().encode(events[index]));
          index++;
          setTimeout(push, 10); // Simulate async chunks
        } else {
          controller.close();
        }
      }
      push();
    }
  });
};

describe('ConversationService', () => {
  // Constants for testing
  const API_KEY = 'test-api-key';
  const API_BASE_URL = 'https://test-api.mistral.ai/v1';
  const MOCK_AGENT_ID = 'agent_123456789';
  const MOCK_CONVERSATION_ID = 'conv_123456789';
  const MOCK_MESSAGE_ID = 'msg_123456789';
  
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

  // Sample SSE events for streaming tests
  const mockSSEEvents = {
    conversationStarted: 'event: conversation.response.started\ndata: {"conversation_id": "conv_123456789"}\n\n',
    toolExecutionStarted: 'event: tool.execution.started\ndata: {"name": "document_library.search", "output_index": 0}\n\n',
    toolExecutionDone: 'event: tool.execution.done\ndata: {"name": "document_library.search", "output_index": 0}\n\n',
    agentHandoff: 'event: agent.handoff.started\ndata: {"agent_id": "agent_987654321", "agent_name": "Websearch Agent"}\n\n',
    messageDelta1: 'event: message.output.delta\ndata: {"content": "This is a "}\n\n',
    messageDelta2: 'event: message.output.delta\ndata: {"content": "test response"}\n\n',
    conversationDone: 'event: conversation.response.done\ndata: {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}\n\n',
    invalidEvent: 'event: unknown.event\ndata: {"some": "data"}\n\n'
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
        `${API_BASE_URL}/conversations`,
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
        `${API_BASE_URL}/conversations/${MOCK_CONVERSATION_ID}`,
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
    it('should successfully restart a conversation', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const restartRequest: ConversationRestartRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        messageId: MOCK_MESSAGE_ID,
        inputs: 'Restart message'
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockApiResponse
      });
      
      // Act
      const result = await service.restart(restartRequest);
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/conversations/${MOCK_CONVERSATION_ID}/restart`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: expect.any(String)
        })
      );
      
      // Verify the body contains the correct request payload
      const calledBody = JSON.parse((fetchWithRetry as jest.Mock).mock.calls[0][1].body);
      expect(calledBody).toEqual({
        message_id: MOCK_MESSAGE_ID,
        inputs: 'Restart message'
      });
      
      expect(result.success).toBe(true);
    });
    
    it('should handle API errors when restarting a conversation', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const restartRequest: ConversationRestartRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        messageId: MOCK_MESSAGE_ID,
        inputs: 'Restart message'
      };
      
      const mockError = new Error('API error');
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: mockError
      });
      
      // Act
      const result = await service.restart(restartRequest);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
    });
  });
  
  describe('streaming methods', () => {
    it('should successfully start a conversation with streaming', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.toolExecutionStarted,
        mockSSEEvents.toolExecutionDone,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.messageDelta2,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Act
      const stream = await service.startStream(request);
      const events: StreamEvent[] = [];
      
      // Collect all events from the stream
      for await (const event of stream) {
        events.push(event);
      }
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/conversations`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'text/event-stream'
          }),
          body: expect.stringContaining('"stream":true')
        })
      );
      
      // Verify all events were received
      expect(events.length).toBe(6);
      
      // Check specific event types
      expect(events[0].type).toBe(StreamEventType.CONVERSATION_RESPONSE_STARTED);
      expect(events[1].type).toBe(StreamEventType.TOOL_EXECUTION_STARTED);
      expect(events[2].type).toBe(StreamEventType.TOOL_EXECUTION_DONE);
      expect(events[3].type).toBe(StreamEventType.MESSAGE_OUTPUT_DELTA);
      expect(events[4].type).toBe(StreamEventType.MESSAGE_OUTPUT_DELTA);
      expect(events[5].type).toBe(StreamEventType.CONVERSATION_RESPONSE_DONE);
      
      // Check event data
      expect(events[0].data.conversation_id).toBe(MOCK_CONVERSATION_ID);
      expect(events[3].data.content).toBe('This is a ');
      expect(events[4].data.content).toBe('test response');
      expect(events[5].data.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      });
    });
    
    it('should successfully append to a conversation with streaming', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: MOCK_CONVERSATION_ID,
        inputs: 'Follow-up message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.messageDelta2,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Act
      const stream = await service.appendStream(request);
      const events: StreamEvent[] = [];
      
      // Collect all events from the stream
      for await (const event of stream) {
        events.push(event);
      }
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/conversations/${MOCK_CONVERSATION_ID}`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'text/event-stream'
          }),
          body: expect.stringContaining('"stream":true')
        })
      );
      
      // Verify all events were received
      expect(events.length).toBe(4);
      
      // Check specific event types
      expect(events[0].type).toBe(StreamEventType.CONVERSATION_RESPONSE_STARTED);
      expect(events[1].type).toBe(StreamEventType.MESSAGE_OUTPUT_DELTA);
      expect(events[2].type).toBe(StreamEventType.MESSAGE_OUTPUT_DELTA);
      expect(events[3].type).toBe(StreamEventType.CONVERSATION_RESPONSE_DONE);
    });
    
    it('should successfully restart a conversation with streaming', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationRestartRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        messageId: MOCK_MESSAGE_ID,
        inputs: 'Restart message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.messageDelta2,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Act
      const stream = await service.restartStream(request);
      const events: StreamEvent[] = [];
      
      // Collect all events from the stream
      for await (const event of stream) {
        events.push(event);
      }
      
      // Assert
      expect(fetchWithRetry).toHaveBeenCalledWith(
        `${API_BASE_URL}/conversations/${MOCK_CONVERSATION_ID}/restart`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'text/event-stream'
          }),
          body: expect.stringContaining('"stream":true')
        })
      );
      
      // Verify all events were received
      expect(events.length).toBe(4);
    });
    
    it('should handle agent handoff events', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.toolExecutionStarted,
        mockSSEEvents.toolExecutionDone,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.agentHandoff,
        mockSSEEvents.messageDelta2,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Act
      const stream = await service.startStream(request);
      const events: StreamEvent[] = [];
      
      // Collect all events from the stream
      for await (const event of stream) {
        events.push(event);
      }
      
      // Assert
      // Verify handoff event was received
      expect(events.length).toBe(7);
      
      // Check handoff event
      const handoffEvent = events.find(e => e.type === StreamEventType.AGENT_HANDOFF_STARTED);
      expect(handoffEvent).toBeDefined();
      expect(handoffEvent?.data.agent_id).toBe('agent_987654321');
      expect(handoffEvent?.data.agent_name).toBe('Websearch Agent');
    });
    
    it('should handle unknown event types', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.invalidEvent,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Act
      const stream = await service.startStream(request);
      const events: StreamEvent[] = [];
      
      // Collect all events from the stream
      for await (const event of stream) {
        events.push(event);
      }
      
      // Assert
      expect(events.length).toBe(4);
      
      // Check unknown event
      const unknownEvent = events.find(e => e.type === StreamEventType.UNKNOWN);
      expect(unknownEvent).toBeDefined();
      expect(unknownEvent?.data.some).toBe('data');
    });
    
    it('should handle errors when starting a streaming conversation', async () => {
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
      
      // Act & Assert
      await expect(service.startStream(request)).rejects.toThrow('API error');
    });
    
    it('should handle missing stream body', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      const mockResponse = {
        ok: true,
        status: 200
        // No body property
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Act & Assert
      await expect(service.startStream(request)).rejects.toThrow('Stream body missing from response');
    });
  });
  
  describe('callback-based streaming methods', () => {
    it('should call the callback for each event in startStreamWithCallback', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Test message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Mock callback
      const mockCallback = jest.fn();
      
      // Act
      await service.startStreamWithCallback(request, mockCallback);
      
      // Assert
      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: StreamEventType.CONVERSATION_RESPONSE_STARTED
      }));
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: StreamEventType.MESSAGE_OUTPUT_DELTA
      }));
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        type: StreamEventType.CONVERSATION_RESPONSE_DONE
      }));
    });
    
    it('should call the callback for each event in appendStreamWithCallback', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationAppendRequest = {
        agentId: MOCK_AGENT_ID,
        conversationId: MOCK_CONVERSATION_ID,
        inputs: 'Follow-up message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Mock callback
      const mockCallback = jest.fn();
      
      // Act
      await service.appendStreamWithCallback(request, mockCallback);
      
      // Assert
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });
    
    it('should call the callback for each event in restartStreamWithCallback', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      const request: ConversationRestartRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        messageId: MOCK_MESSAGE_ID,
        inputs: 'Restart message'
      };
      
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.conversationDone
      ]);
      
      const mockResponse = {
        ok: true,
        status: 200,
        body: mockStream
      };
      
      (fetchWithRetry as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockResponse
      });
      
      // Mock callback
      const mockCallback = jest.fn();
      
      // Act
      await service.restartStreamWithCallback(request, mockCallback);
      
      // Assert
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });
    
    it('should propagate errors in callback-based streaming methods', async () => {
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
      
      // Mock callback
      const mockCallback = jest.fn();
      
      // Act & Assert
      await expect(service.startStreamWithCallback(request, mockCallback)).rejects.toThrow('API error');
      expect(mockCallback).not.toHaveBeenCalled();
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
      expect(result.error.message).toBe('Not implemented - Phase 3');
    });
    
    it('listConversations should return not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      
      // Act
      const result = await service.listConversations();
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Not implemented - Phase 3');
    });
    
    it('deleteConversation should return not implemented error', async () => {
      // Arrange
      const service = new ConversationService(API_KEY, API_BASE_URL);
      
      // Act
      const result = await service.deleteConversation(MOCK_CONVERSATION_ID);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Not implemented - Phase 3');
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
      expect(result.error.message).toBe('Not implemented - Phase 3');
    });
  });
});
