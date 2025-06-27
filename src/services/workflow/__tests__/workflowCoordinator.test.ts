/**
 * @file Unit tests for WorkflowCoordinator
 *
 * These tests verify the functionality of the WorkflowCoordinator class,
 * which orchestrates the chat workflow based on streaming events from the
 * ConversationService.
 */

import { WorkflowCoordinator, WorkflowState } from '../workflowCoordinator';
import ConversationService from '../../mistral/conversationService';
import {
  AgentCompletionResponse,
  ConversationAppendRequest,
  ConversationRestartRequest,
  ConversationStartRequest,
  StreamEvent,
  StreamEventType,
} from '../../../types';

// Mock the ConversationService
jest.mock('../../mistral/conversationService');

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
    },
  });
};

describe('WorkflowCoordinator', () => {
  const API_KEY = 'test-api-key';
  const API_BASE_URL = 'https://test-api.mistral.ai/v1';
  const MOCK_AGENT_ID = 'agent_123';
  const MOCK_CONVERSATION_ID = 'conv_456';
  const MOCK_MESSAGE_ID = 'msg_789';

  let mockConversationService: jest.Mocked<ConversationService>;
  let coordinator: WorkflowCoordinator;

  // Sample API response for testing
  const mockApiResponse: AgentCompletionResponse = {
    id: MOCK_CONVERSATION_ID,
    object: 'agent.completion',
    created_at: Date.now(),
    conversation_id: MOCK_CONVERSATION_ID,
    content: 'Final response content.',
    sources: [],
    hasPdfUrls: false,
    stepName: 'Final Step',
    workflowPath: ['Initial Step', 'Final Step'],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
    choices: [],
    rawApiResponse: {},
  };

  // Sample SSE events for streaming tests
  const mockSSEEvents = {
    conversationStarted: `event: conversation.response.started\ndata: {"conversation_id": "${MOCK_CONVERSATION_ID}"}\n\n`,
    toolExecutionStarted: `event: tool.execution.started\ndata: {"name": "document_library.search", "output_index": 0}\n\n`,
    toolExecutionDone: `event: tool.execution.done\ndata: {"name": "document_library.search", "output_index": 0, "outputs": {"documents": [{"text": "doc content"}]}}\n\n`,
    agentHandoff: `event: agent.handoff.started\ndata: {"agent_id": "agent_987", "agent_name": "Websearch Agent"}\n\n`,
    messageDelta1: `event: message.output.delta\ndata: {"content": "Hello "}\n\n`,
    messageDelta2: `event: message.output.delta\ndata: {"content": "world!"}\n\n`,
    conversationDone: `event: conversation.response.done\ndata: {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}\n\n`,
    invalidEvent: `event: unknown.event\ndata: {"some": "data"}\n\n`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConversationService = new ConversationService(
      API_KEY,
      API_BASE_URL
    ) as jest.Mocked<ConversationService>;
    coordinator = new WorkflowCoordinator(mockConversationService);
  });

  describe('constructor', () => {
    it('should initialize with a ConversationService instance', () => {
      expect(coordinator).toBeInstanceOf(WorkflowCoordinator);
    });

    it('should have an initial empty workflow state', () => {
      const initialState = coordinator.getWorkflowState();
      expect(initialState.conversationId).toBeNull();
      expect(initialState.currentAgent).toBeNull();
      expect(initialState.workflowPath).toEqual([]);
      expect(initialState.accumulatedContent).toBe('');
      expect(initialState.sources).toEqual([]);
      expect(initialState.isProcessing).toBe(false);
      expect(initialState.error).toBeNull();
      expect(initialState.rawEvents).toEqual([]);
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a new workflow and update state correctly', async () => {
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Hello',
      };
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.messageDelta2,
        mockSSEEvents.conversationDone,
      ]);

      mockConversationService.startStream.mockResolvedValueOnce(mockStream);

      const onUpdateMock = jest.fn();
      const result = await coordinator.executeWorkflow(
        request,
        'Document Library',
        onUpdateMock
      );

      expect(mockConversationService.startStream).toHaveBeenCalledWith(
        request
      );
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello world!');
      expect(result.data?.conversation_id).toBe(MOCK_CONVERSATION_ID);
      expect(result.data?.workflowPath).toEqual(['Document Library']);
      expect(result.data?.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      });

      // Verify state updates during execution
      expect(onUpdateMock).toHaveBeenCalledTimes(5); // Initial + 4 events
      const finalState = onUpdateMock.mock.calls[4][0];
      expect(finalState.isProcessing).toBe(false);
      expect(finalState.accumulatedContent).toBe('Hello world!');
      expect(finalState.conversationId).toBe(MOCK_CONVERSATION_ID);
      expect(finalState.workflowPath).toEqual(['Document Library']);
      expect(finalState.rawEvents.length).toBe(4);
    });

    it('should handle appending to an existing conversation', async () => {
      const request: ConversationAppendRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        agentId: MOCK_AGENT_ID,
        inputs: 'Follow up',
      };
      const mockStream = createMockReadableStream([
        mockSSEEvents.messageDelta1,
        mockSSEEvents.conversationDone,
      ]);

      mockConversationService.appendStream.mockResolvedValueOnce(mockStream);

      const onUpdateMock = jest.fn();
      const result = await coordinator.executeWorkflow(
        request,
        'Document Library',
        onUpdateMock
      );

      expect(mockConversationService.appendStream).toHaveBeenCalledWith(
        request
      );
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello world!');
      expect(result.data?.conversation_id).toBe(MOCK_CONVERSATION_ID);
    });

    it('should handle restarting a conversation', async () => {
      const request: ConversationRestartRequest = {
        conversationId: MOCK_CONVERSATION_ID,
        messageId: MOCK_MESSAGE_ID,
        inputs: 'Restart from here',
      };
      const mockStream = createMockReadableStream([
        mockSSEEvents.messageDelta1,
        mockSSEEvents.conversationDone,
      ]);

      mockConversationService.restartStream.mockResolvedValueOnce(mockStream);

      const onUpdateMock = jest.fn();
      const result = await coordinator.executeWorkflow(
        request,
        'Document Library',
        onUpdateMock
      );

      expect(mockConversationService.restartStream).toHaveBeenCalledWith(
        request
      );
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello world!');
      expect(result.data?.conversation_id).toBe(MOCK_CONVERSATION_ID);
    });

    it('should handle errors during stream execution', async () => {
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Error message',
      };
      const mockError = new Error('Stream failed');
      mockConversationService.startStream.mockRejectedValueOnce(mockError);

      const onUpdateMock = jest.fn();
      const result = await coordinator.executeWorkflow(
        request,
        'Document Library',
        onUpdateMock
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
      expect(onUpdateMock).toHaveBeenCalled();
      const finalState = onUpdateMock.mock.calls[onUpdateMock.mock.calls.length - 1][0];
      expect(finalState.error).toBe('Stream failed');
      expect(finalState.isProcessing).toBe(false);
    });

    it('should process agent handoff events', async () => {
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Handoff test',
      };
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.messageDelta1,
        mockSSEEvents.agentHandoff,
        mockSSEEvents.messageDelta2,
        mockSSEEvents.conversationDone,
      ]);

      mockConversationService.startStream.mockResolvedValueOnce(mockStream);

      const onUpdateMock = jest.fn();
      await coordinator.executeWorkflow(request, 'Document Library', onUpdateMock);

      const finalState = coordinator.getWorkflowState();
      expect(finalState.workflowPath).toEqual(['Document Library', 'Websearch Agent']);
      expect(finalState.accumulatedContent).toContain('Handoff to Websearch Agent');
      expect(finalState.accumulatedContent).toContain('Hello world!');
    });

    it('should extract sources from tool execution done events', async () => {
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Source test',
      };
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.toolExecutionDone,
        mockSSEEvents.conversationDone,
      ]);

      mockConversationService.startStream.mockResolvedValueOnce(mockStream);

      const onUpdateMock = jest.fn();
      await coordinator.executeWorkflow(request, 'Document Library', onUpdateMock);

      const finalState = coordinator.getWorkflowState();
      expect(finalState.sources.length).toBe(1);
      expect(finalState.sources[0]).toEqual({
        title: 'document_library.search',
        url: '{"documents":[{"text":"doc content"}]}', // Raw JSON string from mock
        source: 'document_library',
      });
    });

    it('should handle unknown stream event types gracefully', async () => {
      const request: ConversationStartRequest = {
        agentId: MOCK_AGENT_ID,
        inputs: 'Unknown event test',
      };
      const mockStream = createMockReadableStream([
        mockSSEEvents.conversationStarted,
        mockSSEEvents.invalidEvent,
        mockSSEEvents.conversationDone,
      ]);

      mockConversationService.startStream.mockResolvedValueOnce(mockStream);

      const onUpdateMock = jest.fn();
      await coordinator.executeWorkflow(request, 'Document Library', onUpdateMock);

      const finalState = coordinator.getWorkflowState();
      expect(finalState.rawEvents.length).toBe(3);
      expect(finalState.rawEvents.some(e => e.type === StreamEventType.UNKNOWN)).toBe(true);
      // Should not have caused an error or stopped processing
      expect(finalState.error).toBeNull();
    });
  });

  describe('resetWorkflowState', () => {
    it('should reset the workflow state to initial values', () => {
      coordinator.executeWorkflow(
        { agentId: MOCK_AGENT_ID, inputs: 'Test' },
        'Agent'
      ); // Populate state
      coordinator.resetWorkflowState();
      const state = coordinator.getWorkflowState();
      expect(state.conversationId).toBeNull();
      expect(state.currentAgent).toBeNull();
      expect(state.workflowPath).toEqual([]);
      expect(state.accumulatedContent).toBe('');
      expect(state.sources).toEqual([]);
      expect(state.isProcessing).toBe(false);
      expect(state.error).toBeNull();
      expect(state.rawEvents).toEqual([]);
    });
  });

  describe('getWorkflowState', () => {
    it('should return a copy of the current workflow state', () => {
      const state1 = coordinator.getWorkflowState();
      state1.conversationId = 'new_id';
      const state2 = coordinator.getWorkflowState();
      expect(state2.conversationId).toBeNull(); // Should not be modified
    });
  });
});
