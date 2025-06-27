/**
 * @file Type definitions for IAE Chatbot Mistral
 * 
 * This file contains all TypeScript types used throughout the application,
 * representing the data structures for messages, agents, API responses,
 * and workflow management.
 */

// =============================================================================
// Message Types
// =============================================================================

/**
 * Base message interface shared by both user and bot messages
 */
export interface BaseMessage {
  id: number;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  sources: MessageSource[];
}

/**
 * User message in the chat
 */
export interface UserMessage extends BaseMessage {
  type: 'user';
}

/**
 * Bot message with additional metadata
 */
export interface BotMessage extends BaseMessage {
  type: 'bot';
  workflowPath?: string[];
  rawApiResponse?: any;
  stepName?: string;
}

/**
 * Union type for all message types
 */
export type Message = UserMessage | BotMessage;

/**
 * Source reference for messages (e.g., links to documents)
 */
export interface MessageSource {
  title?: string;
  url: string;
  source?: string;
}

// =============================================================================
// Agent Types
// =============================================================================

/**
 * Agent configuration for Mistral AI
 */
export interface AgentConfig {
  model: string;
  name: string;
  description: string;
  instructions: string;
  tools: AgentTool[];
  temperature?: number;
  top_p?: number;
  handoffs?: string[]; // Agent IDs for handoff
}

/**
 * Agent instance with ID
 */
export interface Agent extends AgentConfig {
  id: string;
}

/**
 * Agent collection by type
 */
export interface AgentCollection {
  documentLibrary: Agent | null;
  websearch: Agent | null;
  docQA: Agent | null;
  [key: string]: Agent | null;
}

/**
 * Tool configuration for agents
 */
export interface AgentTool {
  type: string;
  document_library?: {
    library_ids: string[];
  };
  [key: string]: any;
}

// =============================================================================
// Workflow Types
// =============================================================================

/**
 * Status of a workflow step
 */
export type WorkflowStepStatus = 'pending' | 'active' | 'completed';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: number;
  name: string;
  icon: string;
  status: WorkflowStepStatus;
  agent: keyof AgentCollection;
}

/**
 * Result of a workflow execution
 */
export interface WorkflowResult {
  content: string;
  sources: MessageSource[];
  rawApiResponse: any;
  hasPdfUrls?: boolean;
  workflowPath: string[];
  stepName: string;
}

// =============================================================================
// API Types - Current Implementation
// =============================================================================

/**
 * Agent completion request payload
 */
export interface AgentCompletionRequest {
  agent_id: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
}

/**
 * Tool call in API response
 */
export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Message in API response
 */
export interface ApiResponseMessage {
  role: string;
  content: string;
  tool_calls?: ToolCall[];
}

/**
 * Choice in API response
 */
export interface ApiResponseChoice {
  message: ApiResponseMessage;
  finish_reason: string;
  index: number;
}

/**
 * Usage statistics in API response
 */
export interface ApiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  connector_tokens?: number;
  connectors?: {
    [key: string]: number;
  };
}

/**
 * API response from /agents/completions
 */
export interface AgentCompletionResponse {
  id: string;
  object: string;
  created_at: number;
  conversation_id: string;
  choices: ApiResponseChoice[];
  usage: ApiUsage;
  outputs?: ApiOutput[];
}

/**
 * API output types
 */
export type ApiOutputType = 'tool.execution' | 'message.output';

/**
 * Base API output
 */
export interface BaseApiOutput {
  type: ApiOutputType;
  object: string;
  id: string;
  created_at: number;
  completed_at: number;
  output_index: number;
  status: 'completed' | 'failed';
}

/**
 * Tool execution output
 */
export interface ToolExecutionOutput extends BaseApiOutput {
  type: 'tool.execution';
  name: string;
  inputs: any;
  outputs: any;
}

/**
 * Message output content chunk
 */
export interface MessageOutputContentChunk {
  type: 'text' | 'tool_reference';
  text?: string;
  tool?: string;
  title?: string;
  url?: string;
  source?: string;
}

/**
 * Message output
 */
export interface MessageOutput extends BaseApiOutput {
  type: 'message.output';
  agent_id: string;
  model: string;
  role: string;
  content: MessageOutputContentChunk[];
}

/**
 * Union type for API outputs
 */
export type ApiOutput = ToolExecutionOutput | MessageOutput;

// =============================================================================
// API Types - Target Implementation (v1/conversations)
// =============================================================================

/**
 * Conversation start request
 */
export interface ConversationStartRequest {
  agent_id: string;
  inputs: string;
}

/**
 * Conversation append request
 */
export interface ConversationAppendRequest {
  conversation_id: string;
  inputs: string;
}

/**
 * Conversation restart request
 */
export interface ConversationRestartRequest {
  conversation_id: string;
  inputs: string;
}

/**
 * Streaming event types
 */
export enum StreamEventType {
  CONVERSATION_RESPONSE_STARTED = 'conversation.response.started',
  TOOL_EXECUTION_STARTED = 'tool.execution.started',
  TOOL_EXECUTION_DONE = 'tool.execution.done',
  AGENT_HANDOFF_STARTED = 'agent.handoff.started',
  MESSAGE_OUTPUT_DELTA = 'message.output.delta',
  CONVERSATION_RESPONSE_DONE = 'conversation.response.done',
}

/**
 * Base streaming event
 */
export interface BaseStreamEvent {
  type: StreamEventType;
}

/**
 * Conversation response started event
 */
export interface ConversationResponseStartedEvent extends BaseStreamEvent {
  type: StreamEventType.CONVERSATION_RESPONSE_STARTED;
  conversation_id: string;
}

/**
 * Tool execution started event
 */
export interface ToolExecutionStartedEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_EXECUTION_STARTED;
  name: string;
  output_index: number;
}

/**
 * Tool execution done event
 */
export interface ToolExecutionDoneEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_EXECUTION_DONE;
  name: string;
  output_index: number;
}

/**
 * Agent handoff started event
 */
export interface AgentHandoffStartedEvent extends BaseStreamEvent {
  type: StreamEventType.AGENT_HANDOFF_STARTED;
  agent_id: string;
  agent_name: string;
}

/**
 * Message output delta event
 */
export interface MessageOutputDeltaEvent extends BaseStreamEvent {
  type: StreamEventType.MESSAGE_OUTPUT_DELTA;
  content: string;
}

/**
 * Conversation response done event
 */
export interface ConversationResponseDoneEvent extends BaseStreamEvent {
  type: StreamEventType.CONVERSATION_RESPONSE_DONE;
  usage: ApiUsage;
}

/**
 * Union type for all streaming events
 */
export type StreamEvent =
  | ConversationResponseStartedEvent
  | ToolExecutionStartedEvent
  | ToolExecutionDoneEvent
  | AgentHandoffStartedEvent
  | MessageOutputDeltaEvent
  | ConversationResponseDoneEvent;

// =============================================================================
// Environment & Configuration Types
// =============================================================================

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  MISTRAL_API_BASE: string;
  MISTRAL_API_KEY: string;
}

/**
 * Service result with error handling
 */
export interface Result<T, E = Error> {
  data?: T;
  error?: E;
  success: boolean;
}

/**
 * Fetch options with retry configuration
 */
export interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  backoff?: number;
  maxBackoff?: number;
  timeout?: number;
}
