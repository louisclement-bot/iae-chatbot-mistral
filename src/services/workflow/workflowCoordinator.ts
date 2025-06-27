/**
 * @file Workflow Coordinator for IAE Chatbot Mistral
 *
 * This module provides a lightweight workflow coordinator that leverages
 * server-side handoffs and streaming events implemented in Phase 3.
 * It acts as a thin abstraction layer to monitor and manage the workflow
 * progress based on events received from the ConversationService.
 */

// Service layer
import ConversationService from '@services/mistral/conversationService';

// Shared type definitions
import {
  StreamEvent,
  StreamEventType,
  MessageSource,
  Result,
  AgentCompletionResponse,
  ConversationStartRequest,
  ConversationAppendRequest,
  ConversationRestartRequest,
} from '@types/index';

/**
 * Represents the current state of a workflow being executed.
 */
export interface WorkflowState {
  conversationId: string | null;
  currentAgent: string | null;
  workflowPath: string[];
  accumulatedContent: string;
  sources: MessageSource[];
  isProcessing: boolean;
  error: string | null;
  rawEvents: StreamEvent[];
}

/**
 * WorkflowCoordinator class
 * Provides a simple interface for starting and monitoring workflows
 * that leverage server-side agent handoffs and streaming.
 */
export class WorkflowCoordinator {
  private conversationService: ConversationService;
  private currentWorkflowState: WorkflowState;

  constructor(conversationService: ConversationService) {
    this.conversationService = conversationService;
    this.currentWorkflowState = {
      conversationId: null,
      currentAgent: null,
      workflowPath: [],
      accumulatedContent: '',
      sources: [],
      isProcessing: false,
      error: null,
      rawEvents: [],
    };
  }

  /**
   * Starts a new workflow or appends to an existing one, processing streaming events.
   *
   * @param request The conversation start or append request.
   * @param initialAgentName The name of the initial agent expected to handle the request.
   * @param onUpdate Optional callback for real-time state updates.
   * @returns A Promise that resolves with the final AgentCompletionResponse or rejects with an error.
   */
  public async executeWorkflow(
    request: ConversationStartRequest | ConversationAppendRequest | ConversationRestartRequest,
    initialAgentName: string,
    onUpdate?: (state: WorkflowState) => void
  ): Promise<Result<AgentCompletionResponse, Error>> {
    this.resetWorkflowState();
    this.currentWorkflowState.isProcessing = true;
    this.currentWorkflowState.currentAgent = initialAgentName;
    this.currentWorkflowState.workflowPath.push(initialAgentName);
    onUpdate?.(this.currentWorkflowState);

    try {
      let stream: AsyncIterable<StreamEvent>;

      if ('conversationId' in request && request.conversationId) {
        // If it's an append or restart request with a conversationId
        this.currentWorkflowState.conversationId = request.conversationId;
        if ('messageId' in request) {
          // It's a restart request
          stream = await this.conversationService.restartStream(request as ConversationRestartRequest);
        } else {
          // It's an append request
          stream = await this.conversationService.appendStream(request as ConversationAppendRequest);
        }
      } else {
        // It's a start request
        stream = await this.conversationService.startStream(request as ConversationStartRequest);
      }

      for await (const event of stream) {
        this.currentWorkflowState.rawEvents.push(event); // Store all raw events
        this.processStreamEvent(event);
        onUpdate?.(this.currentWorkflowState);
      }

      // After stream completes, return a success result with the final accumulated content
      // Note: The actual AgentCompletionResponse structure might need to be reconstructed
      // from the final event data or accumulated content. For now, we'll use a simplified version.
      const finalResponse: AgentCompletionResponse = {
        id: this.currentWorkflowState.conversationId || 'unknown_conv_id',
        object: 'conversation.completion',
        created_at: Date.now(),
        conversation_id: this.currentWorkflowState.conversationId || 'unknown_conv_id',
        content: this.currentWorkflowState.accumulatedContent,
        sources: this.currentWorkflowState.sources,
        hasPdfUrls: this.currentWorkflowState.sources.some(s => s.url.endsWith('.pdf')),
        stepName: this.currentWorkflowState.workflowPath[this.currentWorkflowState.workflowPath.length - 1],
        workflowPath: this.currentWorkflowState.workflowPath,
        usage: this.currentWorkflowState.rawEvents.find(e => e.type === StreamEventType.CONVERSATION_RESPONSE_DONE)?.data?.usage || {},
        choices: [], // Not directly available from stream events in this simplified model
        rawApiResponse: this.currentWorkflowState.rawEvents, // Store raw events for debugging
      };

      return { success: true, data: finalResponse };
    } catch (error) {
      this.currentWorkflowState.error = error instanceof Error ? error.message : String(error);
      onUpdate?.(this.currentWorkflowState);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    } finally {
      this.currentWorkflowState.isProcessing = false;
      onUpdate?.(this.currentWorkflowState);
    }
  }

  /**
   * Processes a single streaming event and updates the workflow state.
   * @param event The StreamEvent to process.
   */
  private processStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case StreamEventType.CONVERSATION_RESPONSE_STARTED:
        this.currentWorkflowState.conversationId = event.data?.conversation_id || null;
        break;
      case StreamEventType.MESSAGE_OUTPUT_DELTA:
        this.currentWorkflowState.accumulatedContent += event.data?.content || '';
        break;
      case StreamEventType.AGENT_HANDOFF_STARTED:
        const newAgentName = event.data?.agent_name || 'Unknown Agent';
        this.currentWorkflowState.currentAgent = newAgentName;
        if (!this.currentWorkflowState.workflowPath.includes(newAgentName)) {
          this.currentWorkflowState.workflowPath.push(newAgentName);
        }
        this.currentWorkflowState.accumulatedContent += `\n\n**Handoff to ${newAgentName}**\n\n`;
        break;
      case StreamEventType.TOOL_EXECUTION_DONE:
        // Extract sources from tool execution results if available
        if (event.data?.name && event.data?.outputs) {
          try {
            const toolName = event.data.name;
            const toolOutput = typeof event.data.outputs === 'string'
              ? event.data.outputs
              : JSON.stringify(event.data.outputs);

            // Simple heuristic for sources, can be refined based on actual tool output structure
            if (toolOutput.includes('http')) {
              const urlMatch = toolOutput.match(/(https?:\/\/[^\s]+)/);
              if (urlMatch) {
                this.currentWorkflowState.sources.push({
                  title: toolName,
                  url: urlMatch[0],
                  source: toolName.split('.')[0], // e.g., 'document_library'
                });
              }
            }
          } catch (e) {
            console.error('Error parsing tool output for sources:', e);
          }
        }
        break;
      case StreamEventType.CONVERSATION_RESPONSE_DONE:
        // Final usage stats are in this event's data
        break;
      case StreamEventType.UNKNOWN:
        console.warn('Received unknown stream event type:', event.data);
        break;
      default:
        // Handle other known event types if necessary, or ignore
        break;
    }
  }

  /**
   * Resets the workflow state to its initial values.
   */
  public resetWorkflowState(): void {
    this.currentWorkflowState = {
      conversationId: null,
      currentAgent: null,
      workflowPath: [],
      accumulatedContent: '',
      sources: [],
      isProcessing: false,
      error: null,
      rawEvents: [],
    };
  }

  /**
   * Returns the current state of the workflow.
   * @returns The current WorkflowState.
   */
  public getWorkflowState(): WorkflowState {
    return { ...this.currentWorkflowState }; // Return a copy to prevent direct modification
  }
}

// Optional: Create a singleton instance if preferred, similar to services
// export const createWorkflowCoordinator = (conversationService: ConversationService): WorkflowCoordinator => {
//   return new WorkflowCoordinator(conversationService);
// };
