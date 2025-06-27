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
} from '@types';

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
  private getHeaders(isStreaming: boolean = false): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': isStreaming ? 'text/event-stream' : 'application/json',
      'User-Agent': 'iae-chatbot/1.0 (+https://iae.univ-lyon3.fr)'
    };
  }

  /**
   * Parse the response from an agent completion
   * 
   * @param data - Response data from the API
   * @param stepName - Name of the step that generated the response
   * @returns Parsed agent completion result
   */
  private parseAgentResponse(
    data: any,
    stepName: string
  ): {
    content: string;
    sources: MessageSource[];
    rawApiResponse: any;
    hasPdfUrls: boolean;
    stepName: string;
  } {
    const message = data.choices && data.choices[0] && data.choices[0].message;
    
    if (!message) {
      throw new Error(`Invalid response from ${stepName}`);
    }

    let content = message.content || '';
    const sources: MessageSource[] = [];
    let hasPdfUrls = false;

    // Detect PDF URLs in the content
    if (content.includes('.pdf')) {
      hasPdfUrls = true;
    }

    // Process tool_calls if they exist
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
      rawApiResponse: data,
      hasPdfUrls,
      stepName
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
      // Using the current /agents/completions endpoint
      const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/completions`;
      
      // Format the request based on the current App.js implementation
      // Use agent_id if provided, otherwise fall back to agentId
      const payload = {
        agent_id: request.agent_id || request.agentId,
        messages: [
          {
            role: "user",
            content: request.inputs
          }
        ]
      };

      const result = await fetchWithRetry<any>(url, {
        method: 'POST',
        headers: this.getHeaders(options?.stream),
        body: JSON.stringify(payload),
        ...options?.fetchOptions
      });

      if (!result.success) {
        return result;
      }

      // Parse the response
      const stepName = request.stepName || 'Conversation';
      const parsedResponse = this.parseAgentResponse(result.data, stepName);
      
      // Return the parsed response as an AgentCompletionResponse
      const response: AgentCompletionResponse = {
        id: result.data.id,
        object: result.data.object,
        created_at: result.data.created_at || Date.now(),
        conversation_id: result.data.id,
        choices: result.data.choices || [],
        usage: result.data.usage || {},
        content: parsedResponse.content,
        sources: parsedResponse.sources,
        hasPdfUrls: parsedResponse.hasPdfUrls,
        rawApiResponse: parsedResponse.rawApiResponse,
        stepName: parsedResponse.stepName,
        workflowPath: []
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
      // For the current API, append is the same as start since /agents/completions
      // doesn't maintain conversation state
      const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/completions`;
      
      // Format the request based on the current App.js implementation
      // Use agent_id if provided, otherwise fall back to agentId
      const payload = {
        agent_id: request.agentId,
        messages: [
          {
            role: "user",
            content: request.inputs
          }
        ]
      };

      const result = await fetchWithRetry<any>(url, {
        method: 'POST',
        headers: this.getHeaders(options?.stream),
        body: JSON.stringify(payload),
        ...options?.fetchOptions
      });

      if (!result.success) {
        return result;
      }

      // Parse the response
      const stepName = request.stepName || 'Conversation';
      const parsedResponse = this.parseAgentResponse(result.data, stepName);
      
      // Return the parsed response as an AgentCompletionResponse
      const response: AgentCompletionResponse = {
        id: result.data.id,
        object: result.data.object,
        created_at: result.data.created_at || Date.now(),
        conversation_id: request.conversation_id || request.conversationId || result.data.id,
        choices: result.data.choices || [],
        usage: result.data.usage || {},
        content: parsedResponse.content,
        sources: parsedResponse.sources,
        hasPdfUrls: parsedResponse.hasPdfUrls,
        rawApiResponse: parsedResponse.rawApiResponse,
        stepName: parsedResponse.stepName,
        workflowPath: []
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
    // For the current API, restart is the same as start since /agents/completions
    // doesn't maintain conversation state
    return this.start({
      agent_id: request.agent_id || request.agentId,
      inputs: request.inputs,
      stepName: request.stepName
    }, options);
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
    // Not supported in the current /agents/completions API
    // Will be implemented in Phase 3 with the /v1/conversations API
    return {
      success: false,
      error: new Error('Function submission not supported with current API - Will be implemented in Phase 3')
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
    // Not supported in the current /agents/completions API
    // Will be implemented in Phase 3 with the /v1/conversations API
    return {
      success: false,
      error: new Error('Conversation retrieval not supported with current API - Will be implemented in Phase 3')
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
    // Not supported in the current /agents/completions API
    // Will be implemented in Phase 3 with the /v1/conversations API
    return {
      success: false,
      error: new Error('Conversation listing not supported with current API - Will be implemented in Phase 3')
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
    // Not supported in the current /agents/completions API
    // Will be implemented in Phase 3 with the /v1/conversations API
    return {
      success: false,
      error: new Error('Conversation deletion not supported with current API - Will be implemented in Phase 3')
    };
  }

  /**
   * Execute a complete agent workflow
   * 
   * @param userMessage - User message to process
   * @param agents - Map of agent types to agent IDs
   * @param updateWorkflowStep - Function to update workflow step status
   * @param options - Options for executing the workflow
   * @returns Result containing the workflow result
   */
  async executeAgentWorkflow(
    userMessage: string,
    agents: {
      documentLibrary: string;
      websearch: string;
      docQA: string;
    },
    updateWorkflowStep: (stepId: number, status: 'pending' | 'active' | 'completed') => void,
    options?: ConversationBaseOptions
  ): Promise<Result<AgentCompletionResponse, Error>> {
    try {
      // Step 1: Document Library
      updateWorkflowStep(1, 'active');
      
      const docLibResult = await this.start({
        agentId: agents.documentLibrary,
        inputs: userMessage,
        stepName: 'Document Library'
      }, options);
      
      if (!docLibResult.success || !docLibResult.data) {
        throw docLibResult.error || new Error('Failed to get response from Document Library agent');
      }
      
      updateWorkflowStep(1, 'completed');
      
      // Check if Document Library found information
      if (docLibResult.data.content.includes('AUCUNE_INFO_TROUVEE')) {
        // Step 2: Websearch
        updateWorkflowStep(2, 'active');
        
        const searchQuery = `site:iae.univ-lyon3.fr ${userMessage}`;
        const websearchResult = await this.start({
          agentId: agents.websearch,
          inputs: `Recherche des informations sur "${userMessage}" en utilisant web_search avec la requête: "${searchQuery}"`,
          stepName: 'Websearch'
        }, options);
        
        if (!websearchResult.success || !websearchResult.data) {
          throw websearchResult.error || new Error('Failed to get response from Websearch agent');
        }
        
        updateWorkflowStep(2, 'completed');
        
        // Check if Websearch found results
        if (websearchResult.data.content.includes('AUCUN_RESULTAT_WEB')) {
          // No results found
          return {
            success: true,
            data: {
              ...websearchResult.data,
              content: "Désolé, je n'ai trouvé aucune information pertinente dans la base de connaissance de l'IAE ni sur le site officiel. Pourriez-vous reformuler votre question ou être plus précis ?",
              sources: [],
              workflowPath: ['Document Library', 'Websearch']
            }
          };
        }
        
        // Check if PDFs were found
        if (websearchResult.data.hasPdfUrls) {
          // Step 3: Document Q&A for PDF analysis
          updateWorkflowStep(3, 'active');
          
          const docQAResult = await this.start({
            agentId: agents.docQA,
            inputs: `Analyse les documents PDF mentionnés pour répondre à la question: "${userMessage}". Contexte des PDFs trouvés: ${websearchResult.data.content}`,
            stepName: 'Document Q&A'
          }, options);
          
          if (!docQAResult.success || !docQAResult.data) {
            throw docQAResult.error || new Error('Failed to get response from Document Q&A agent');
          }
          
          updateWorkflowStep(3, 'completed');
          
          // Combine results
          return {
            success: true,
            data: {
              ...docQAResult.data,
              content: `${websearchResult.data.content}\n\n**Analyse approfondie des documents:**\n${docQAResult.data.content}`,
              sources: [...(websearchResult.data.sources || []), ...(docQAResult.data.sources || [])],
              workflowPath: ['Document Library', 'Websearch', 'Document Q&A']
            }
          };
        } else {
          // No PDFs, return websearch results
          return {
            success: true,
            data: {
              ...websearchResult.data,
              workflowPath: ['Document Library', 'Websearch']
            }
          };
        }
      } else {
        // Document Library found information, return results
        return {
          success: true,
          data: {
            ...docLibResult.data,
            workflowPath: ['Document Library']
          }
        };
      }
    } catch (error) {
      // Reset workflow steps
      updateWorkflowStep(1, 'pending');
      updateWorkflowStep(2, 'pending');
      updateWorkflowStep(3, 'pending');
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
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
