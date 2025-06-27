/**
 * @file Conversation Service for Mistral AI
 * 
 * Provides methods for starting, appending, restarting, and streaming conversations
 * with Mistral AI agents. This service abstracts the complexity of the Mistral AI API
 * and provides a clean interface for managing conversations.
 */

import fetchWithRetry from '@utils/fetchWithRetry';
import {
  ConversationStartRequest,
  ConversationAppendRequest,
  ConversationRestartRequest,
  AgentCompletionResponse,
  Result,
  FetchWithRetryOptions,
  StreamEvent,
  StreamEventType,
  MessageSource
} from '@types/index';

/**
 * Base options for conversation operations
 */
export interface ConversationBaseOptions {
  /** Override the default API base URL */
  apiBaseUrl?: string;
  /** Override the default retry options */
  fetchOptions?: FetchWithRetryOptions;
}

/**
 * Options for starting a conversation
 */
export interface StartConversationOptions extends ConversationBaseOptions {
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Options for appending to a conversation
 */
export interface AppendConversationOptions extends ConversationBaseOptions {
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Options for restarting a conversation
 */
export interface RestartConversationOptions extends ConversationBaseOptions {
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Stream handler function type
 */
export type StreamEventHandler = (event: StreamEvent) => void;

/**
 * Service for managing conversations with Mistral AI agents
 */
export class ConversationService {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new ConversationService
   * 
   * @param apiKey - Mistral AI API key
   * @param apiBaseUrl - Base URL for the Mistral AI API
   */
  constructor(apiKey: string, apiBaseUrl: string = 'https://api.mistral.ai/v1') {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Get standard headers for API requests
   * 
   * @returns Headers object with Authorization and Content-Type
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'iae-chatbot/1.0 (+https://iae.univ-lyon3.fr)'
    };
  }

  /**
   * Parse the response from the agent completion API
   * 
   * @param data - Raw API response
   * @returns Processed response with content, sources, and PDF detection
   */
  private parseAgentResponse(data: any): {
    content: string;
    sources: MessageSource[];
    hasPdfUrls: boolean;
    rawApiResponse: any;
  } {
    // Extract message content
    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error('Invalid response format: missing message content');
    }

    let content = message.content || '';
    const sources: MessageSource[] = [];
    let hasPdfUrls = false;

    // Detect PDF URLs in content
    if (content.includes('.pdf')) {
      hasPdfUrls = true;
    }

    // Process tool calls if they exist
    if (message.tool_calls) {
      message.tool_calls.forEach((toolCall: any) => {
        if (toolCall.function) {
          sources.push({
            title: toolCall.function.name,
            url: toolCall.function.arguments || '',
            source: toolCall.type
          });
        }
      });
    }

    return {
      content: content.trim(),
      sources,
      hasPdfUrls,
      rawApiResponse: data
    };
  }

  /**
   * Start a new conversation with an agent
   * 
   * @param request - Conversation start request
   * @param options - Options for starting the conversation
   * @returns Result containing the conversation response or an error
   */
  async start(
    request: ConversationStartRequest,
    options?: StartConversationOptions
  ): Promise<Result<AgentCompletionResponse, Error>> {
    try {
      // In the current implementation, we're using /agents/completions
      // This will be migrated to /conversations in Phase 3
      const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/completions`;
      
      const payload = {
        agent_id: request.agentId,
        messages: [
          {
            role: 'user',
            content: request.inputs
          }
        ]
      };
      
      const result = await fetchWithRetry<any>(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        ...options?.fetchOptions
      });
      
      if (!result.success) {
        return result;
      }
      
      const { content, sources, hasPdfUrls, rawApiResponse } = this.parseAgentResponse(result.data);
      
      // Format the response to match our AgentCompletionResponse type
      const response: AgentCompletionResponse = {
        id: rawApiResponse.id,
        object: 'agent.completion',
        created_at: new Date(rawApiResponse.created || Date.now()).getTime(),
        conversation_id: rawApiResponse.id,
        content,
        sources,
        hasPdfUrls,
        rawApiResponse,
        stepName: 'Conversation',
        usage: rawApiResponse.usage || {}
      };
      
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Append to an existing conversation
   * 
   * @param request - Conversation append request
   * @param options - Options for appending to the conversation
   * @returns Result containing the conversation response or an error
   */
  async append(
    request: ConversationAppendRequest,
    options?: AppendConversationOptions
  ): Promise<Result<AgentCompletionResponse, Error>> {
    try {
      // In the current implementation, we're using /agents/completions
      // This will be migrated to /conversations/{conversation_id} in Phase 3
      const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/completions`;
      
      // For now, we're just sending the new message as a user message
      // In the future, we'll send the entire conversation history
      const payload = {
        agent_id: request.agentId,
        messages: [
          {
            role: 'user',
            content: request.inputs
          }
        ]
      };
      
      const result = await fetchWithRetry<any>(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        ...options?.fetchOptions
      });
      
      if (!result.success) {
        return result;
      }
      
      const { content, sources, hasPdfUrls, rawApiResponse } = this.parseAgentResponse(result.data);
      
      // Format the response to match our AgentCompletionResponse type
      const response: AgentCompletionResponse = {
        id: rawApiResponse.id,
        object: 'agent.completion',
        created_at: new Date(rawApiResponse.created || Date.now()).getTime(),
        conversation_id: request.conversationId || rawApiResponse.id,
        content,
        sources,
        hasPdfUrls,
        rawApiResponse,
        stepName: 'Conversation',
        usage: rawApiResponse.usage || {}
      };
      
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Restart a conversation from a specific point
   * 
   * @param request - Conversation restart request
   * @param options - Options for restarting the conversation
   * @returns Result containing the conversation response or an error
   */
  async restart(
    request: ConversationRestartRequest,
    options?: RestartConversationOptions
  ): Promise<Result<AgentCompletionResponse, Error>> {
    // In the current implementation with /agents/completions,
    // there's no concept of restarting a conversation from a specific point.
    // This will be implemented in Phase 3 with the /conversations API.
    return {
      success: false,
      error: new Error('Not implemented - Phase 3')
    };
  }

  /**
   * Start a new conversation with streaming
   * 
   * @param request - Conversation start request
   * @param options - Options for starting the conversation
   * @returns AsyncIterable of StreamEvents
   */
  async startStream(
    request: ConversationStartRequest,
    options?: StartConversationOptions
  ): Promise<AsyncIterable<StreamEvent>> {
    // TODO: Phase 3 - Implement conversation streaming
    // This will call POST /v1/conversations with stream=true and handle SSE
    throw new Error('Not implemented - Phase 3');
  }

  /**
   * Append to an existing conversation with streaming
   * 
   * @param request - Conversation append request
   * @param options - Options for appending to the conversation
   * @returns AsyncIterable of StreamEvents
   */
  async appendStream(
    request: ConversationAppendRequest,
    options?: AppendConversationOptions
  ): Promise<AsyncIterable<StreamEvent>> {
    // TODO: Phase 3 - Implement conversation append streaming
    // This will call POST /v1/conversations/{conversation_id} with stream=true and handle SSE
    throw new Error('Not implemented - Phase 3');
  }

  /**
   * Restart a conversation from a specific point with streaming
   * 
   * @param request - Conversation restart request
   * @param options - Options for restarting the conversation
   * @returns AsyncIterable of StreamEvents
   */
  async restartStream(
    request: ConversationRestartRequest,
    options?: RestartConversationOptions
  ): Promise<AsyncIterable<StreamEvent>> {
    // TODO: Phase 3 - Implement conversation restart streaming
    // This will call POST /v1/conversations/{conversation_id}/restart with stream=true and handle SSE
    throw new Error('Not implemented - Phase 3');
  }

  /**
   * Start a new conversation with a callback-based streaming API
   * 
   * @param request - Conversation start request
   * @param onEvent - Callback for stream events
   * @param options - Options for starting the conversation
   * @returns Promise that resolves when the stream completes
   */
  async startStreamWithCallback(
    request: ConversationStartRequest,
    onEvent: StreamEventHandler,
    options?: StartConversationOptions
  ): Promise<void> {
    // TODO: Phase 3 - Implement callback-based streaming
    // This will use startStream and call onEvent for each event
    throw new Error('Not implemented - Phase 3');
  }

  /**
   * Append to an existing conversation with a callback-based streaming API
   * 
   * @param request - Conversation append request
   * @param onEvent - Callback for stream events
   * @param options - Options for appending to the conversation
   * @returns Promise that resolves when the stream completes
   */
  async appendStreamWithCallback(
    request: ConversationAppendRequest,
    onEvent: StreamEventHandler,
    options?: AppendConversationOptions
  ): Promise<void> {
    // TODO: Phase 3 - Implement callback-based streaming
    // This will use appendStream and call onEvent for each event
    throw new Error('Not implemented - Phase 3');
  }

  /**
   * Restart a conversation from a specific point with a callback-based streaming API
   * 
   * @param request - Conversation restart request
   * @param onEvent - Callback for stream events
   * @param options - Options for restarting the conversation
   * @returns Promise that resolves when the stream completes
   */
  async restartStreamWithCallback(
    request: ConversationRestartRequest,
    onEvent: StreamEventHandler,
    options?: RestartConversationOptions
  ): Promise<void> {
    // TODO: Phase 3 - Implement callback-based streaming
    // This will use restartStream and call onEvent for each event
    throw new Error('Not implemented - Phase 3');
  }

  /**
   * Submit a function result to a conversation
   * 
   * @param conversationId - ID of the conversation
   * @param functionCallId - ID of the function call
   * @param result - Function result
   * @param options - Options for submitting the function result
   * @returns Result containing the conversation response or an error
   */
  async submitFunctionResult(
    conversationId: string,
    functionCallId: string,
    result: any,
    options?: AppendConversationOptions
  ): Promise<Result<AgentCompletionResponse, Error>> {
    // Function result submission is not supported in the current /agents/completions API
    // This will be implemented in Phase 3 with the /conversations API
    return {
      success: false,
      error: new Error('Not implemented - Phase 3')
    };
  }

  /**
   * Get a conversation by ID
   * 
   * @param conversationId - ID of the conversation to get
   * @param options - Options for getting the conversation
   * @returns Result containing the conversation or an error
   */
  async getConversation(
    conversationId: string,
    options?: ConversationBaseOptions
  ): Promise<Result<AgentCompletionResponse, Error>> {
    // Conversation retrieval is not supported in the current /agents/completions API
    // This will be implemented in Phase 3 with the /conversations API
    return {
      success: false,
      error: new Error('Not implemented - Phase 3')
    };
  }

  /**
   * List all conversations
   * 
   * @param options - Options for listing conversations
   * @returns Result containing an array of conversations or an error
   */
  async listConversations(
    options?: ConversationBaseOptions & { limit?: number; offset?: number }
  ): Promise<Result<AgentCompletionResponse[], Error>> {
    // Conversation listing is not supported in the current /agents/completions API
    // This will be implemented in Phase 3 with the /conversations API
    return {
      success: false,
      error: new Error('Not implemented - Phase 3')
    };
  }

  /**
   * Delete a conversation
   * 
   * @param conversationId - ID of the conversation to delete
   * @param options - Options for deleting the conversation
   * @returns Result indicating success or an error
   */
  async deleteConversation(
    conversationId: string,
    options?: ConversationBaseOptions
  ): Promise<Result<void, Error>> {
    // Conversation deletion is not supported in the current /agents/completions API
    // This will be implemented in Phase 3 with the /conversations API
    return {
      success: false,
      error: new Error('Not implemented - Phase 3')
    };
  }

  /**
   * Parse a stream of events from a ReadableStream
   * 
   * @param stream - ReadableStream from fetch response
   * @returns AsyncIterable of StreamEvents
   */
  private async *parseEventStream(stream: ReadableStream<Uint8Array>): AsyncIterable<StreamEvent> {
    // TODO: Phase 3 - Implement SSE parsing
    // This will read the stream and parse SSE events into StreamEvents
    throw new Error('Not implemented - Phase 3');
  }
}

/**
 * Create a singleton instance of the ConversationService
 * 
 * @param apiKey - Mistral AI API key
 * @param apiBaseUrl - Base URL for the Mistral AI API
 * @returns ConversationService instance
 */
export const createConversationService = (
  apiKey: string,
  apiBaseUrl?: string
): ConversationService => {
  return new ConversationService(apiKey, apiBaseUrl);
};

export default ConversationService;
