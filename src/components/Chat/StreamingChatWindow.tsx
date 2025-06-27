/**
 * @file StreamingChatWindow Component
 *
 * This component demonstrates Phase 3 streaming functionality by:
 * - Using the ConversationService with streaming methods
 * - Displaying streaming events as they arrive (conversation.response.started, message.output.delta, agent.handoff.started, etc.)
 * - Showing real-time progress of agent handoffs
 * - Accumulating delta content into complete messages
 * - Displaying tool executions and workflow steps
 * - Handling streaming errors gracefully
 * - Providing a clean interface to test the Phase 3 streaming implementation
 *
 * This is a proof-of-concept component to validate the streaming implementation works correctly.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, ExternalLink, Search, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Services
import { ConversationService, createConversationService } from '../../services/mistral/conversationService';
import { AgentService, createAgentService } from '../../services/mistral/agentService';

// Types
import {
  Message,
  UserMessage,
  BotMessage,
  WorkflowStep,
  StreamEvent,
  StreamEventType,
  MessageSource,
  Agent,
  AgentConfig
} from '../../types';

// Config
import { agentConfigs, configureHandoffs } from '../../config/agents';

/**
 * Props for the StreamingChatWindow component
 */
export interface StreamingChatWindowProps {
  /** API key for Mistral AI */
  apiKey?: string;
  /** Base URL for the Mistral AI API */
  apiBaseUrl?: string;
  /** Initial messages to display */
  initialMessages?: Message[];
  /** Whether to show debug information */
  showDebug?: boolean;
  /** Whether to show API logs */
  showLogs?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * StreamingChatWindow component
 *
 * Demonstrates real-time streaming and agent handoffs.
 */
const StreamingChatWindow: React.FC<StreamingChatWindowProps> = ({
  apiKey = process.env.REACT_APP_MISTRAL_API_KEY,
  apiBaseUrl = 'https://api.mistral.ai/v1',
  initialMessages = [],
  showDebug = true,
  showLogs = true,
  className = '',
}) => {
  // State for messages
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0 ? initialMessages : [
      {
        id: 1,
        type: 'bot',
        content: "Bonjour ! Je suis l'assistant intelligent de l'IAE Lyon 3. Je peux vous aider à trouver des informations sur nos formations, admissions, vie étudiante et plus encore. Comment puis-je vous assister aujourd'hui ?",
        timestamp: new Date(),
        sources: []
      }
    ]
  );

  // State for error and debug information
  const [error, setError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  // State for input and loading
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State for conversation and agents
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentService, setAgentService] = useState<AgentService | null>(null);
  const [conversationService, setConversationService] = useState<ConversationService | null>(null);
  const [agents, setAgents] = useState<Record<string, Agent | null>>({
    documentLibrary: null,
    websearch: null,
    docQA: null
  });

  // State for workflow steps
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    { id: 1, name: 'Document Library', icon: '📚', status: 'pending', agent: 'documentLibrary' },
    { id: 2, name: 'Websearch IAE', icon: '🔍', status: 'pending', agent: 'websearch' },
    { id: 3, name: 'Document Q&A', icon: '📄', status: 'pending', agent: 'docQA' }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll to the bottom of the message list
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Initialize services and agents
   */
  const initializeServicesAndAgents = useCallback(async () => {
    if (!apiKey) {
      setError('API key is not configured. Please set REACT_APP_MISTRAL_API_KEY in .env');
      return;
    }

    try {
      const agentSvc = createAgentService(apiKey, apiBaseUrl);
      const convSvc = createConversationService(apiKey, apiBaseUrl);
      setAgentService(agentSvc);
      setConversationService(convSvc);

      // Test API connectivity
      const connectivityResult = await agentSvc.testConnectivity();
      if (!connectivityResult.success) {
        throw connectivityResult.error;
      }
      setDebugInfo(prev => prev + 'API connectivity OK. Creating agents...\n');

      // Create or retrieve agents
      const allAgentConfigs: Record<string, AgentConfig> = {
        documentLibrary: { ...agentConfigs.documentLibrary },
        websearch: { ...agentConfigs.websearch },
        docQA: { ...agentConfigs.docQA }
      };

      const createdAgentsResult = await agentSvc.createAllAgents(allAgentConfigs);
      if (!createdAgentsResult.success) {
        throw createdAgentsResult.error;
      }
      const createdAgents = createdAgentsResult.data;

      // Configure handoffs
      const configuredAgentConfigs = configureHandoffs({
        documentLibrary: createdAgents.documentLibrary.id,
        websearch: createdAgents.websearch.id,
        docQA: createdAgents.docQA.id
      });

      // Update agents with handoffs
      const updatePromises = Object.keys(configuredAgentConfigs).map(async (key) => {
        const agentId = createdAgents[key]?.id;
        const config = configuredAgentConfigs[key];
        if (agentId && config) {
          const updateResult = await agentSvc.updateAgent(agentId, config, { replace: true });
          if (!updateResult.success) {
            throw new Error(`Failed to update agent ${key} with handoffs: ${updateResult.error.message}`);
          }
          return [key, updateResult.data];
        }
        return [key, createdAgents[key]];
      });

      const updatedAgentsArray = await Promise.all(updatePromises);
      const updatedAgents = Object.fromEntries(updatedAgentsArray) as Record<string, Agent>;

      setAgents(updatedAgents);
      setDebugInfo(prev => prev + 'Agents created and handoffs configured successfully.\n');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during initialization';
      setError(`Initialization failed: ${errorMessage}`);
      setDebugInfo(prev => prev + `Initialization error details: ${JSON.stringify(err)}\n`);
    }
  }, [apiKey, apiBaseUrl]);

  useEffect(() => {
    initializeServicesAndAgents().catch(console.error);
  }, [initializeServicesAndAgents]);

  /**
   * Update workflow step status
   */
  const updateWorkflowStep = (stepName: string, status: 'pending' | 'active' | 'completed') => {
    setWorkflowSteps(prev => prev.map(step =>
      step.name === stepName ? { ...step, status } : step
    ));
  };

  /**
   * Reset all workflow steps to pending
   */
  const resetWorkflowSteps = () => {
    setWorkflowSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  /**
   * Find the agent name from agent ID
   */
  const getAgentNameFromId = (agentId: string): string | undefined => {
    for (const [key, agent] of Object.entries(agents)) {
      if (agent?.id === agentId) {
        return agent.name;
      }
    }
    return undefined;
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversationService || !agents.documentLibrary) return;

    const userMessage: UserMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      sources: []
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError('');
    resetWorkflowSteps();
    setLogs([]);

    // Create a placeholder for the bot's response
    const botMessageId = Date.now() + 1;
    const initialBotMessage: BotMessage = {
      id: botMessageId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
      sources: [],
      workflowPath: []
    };
    setMessages(prev => [...prev, initialBotMessage]);

    try {
      // Determine whether to start a new conversation or append to an existing one
      const stream = conversationId
        ? await conversationService.appendStream({
            conversationId,
            agentId: agents.documentLibrary.id,
            inputs: inputMessage
          })
        : await conversationService.startStream({
            agentId: agents.documentLibrary.id,
            inputs: inputMessage
          });

      // Track the current active agent
      let currentAgentName = 'Document Library';
      // Track the accumulated content
      let accumulatedContent = '';
      // Track the sources
      const sources: MessageSource[] = [];
      // Track the workflow path
      const workflowPath: string[] = [currentAgentName];

      // Process the stream of events
      for await (const event of stream) {
        // Log the event for debugging
        const eventLog = `Event: ${event.type} - ${JSON.stringify(event.data || {})}`;
        setLogs(prev => [...prev, eventLog]);
        
        // Process the event based on its type
        switch (event.type) {
          case StreamEventType.CONVERSATION_RESPONSE_STARTED:
            // Store the conversation ID for future messages
            if (event.data?.conversation_id) {
              setConversationId(event.data.conversation_id);
            }
            // Set the first agent as active
            updateWorkflowStep(currentAgentName, 'active');
            break;

          case StreamEventType.MESSAGE_OUTPUT_DELTA:
            // Append the content delta to the accumulated content
            if (event.data?.content) {
              accumulatedContent += event.data.content;
              // Update the bot message with the new content
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.id === botMessageId) {
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: accumulatedContent
                  };
                }
                return newMessages;
              });
            }
            break;

          case StreamEventType.TOOL_EXECUTION_STARTED:
            // Log tool execution
            if (event.data?.name) {
              setDebugInfo(prev => prev + `Tool execution started: ${event.data.name}\n`);
            }
            break;

          case StreamEventType.TOOL_EXECUTION_DONE:
            // Add tool execution result to sources if available
            if (event.data?.outputs) {
              try {
                const toolName = event.data.name || 'unknown';
                const toolOutput = typeof event.data.outputs === 'string' 
                  ? event.data.outputs 
                  : JSON.stringify(event.data.outputs);
                
                sources.push({
                  title: toolName,
                  url: toolOutput,
                  source: 'tool_execution'
                });
              } catch (err) {
                console.error('Error processing tool execution:', err);
              }
            }
            break;

          case StreamEventType.AGENT_HANDOFF_STARTED:
            // Mark the current agent as completed
            updateWorkflowStep(currentAgentName, 'completed');
            
            // Get the new agent name
            const newAgentName = event.data?.agent_name || getAgentNameFromId(event.data?.agent_id) || 'Unknown Agent';
            
            // Update the current agent
            currentAgentName = newAgentName;
            
            // Add to workflow path
            if (!workflowPath.includes(newAgentName)) {
              workflowPath.push(newAgentName);
            }
            
            // Set the new agent as active
            updateWorkflowStep(newAgentName, 'active');
            
            // Add a separator in the content
            accumulatedContent += `\n\n**Handoff to ${newAgentName}**\n\n`;
            
            // Update the bot message
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.id === botMessageId) {
                newMessages[newMessages.length - 1] = {
                  ...lastMessage,
                  content: accumulatedContent,
                  workflowPath
                };
              }
              return newMessages;
            });
            break;

          case StreamEventType.CONVERSATION_RESPONSE_DONE:
            // Mark the current agent as completed
            updateWorkflowStep(currentAgentName, 'completed');
            
            // Finalize the bot message
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.id === botMessageId) {
                newMessages[newMessages.length - 1] = {
                  ...lastMessage,
                  content: accumulatedContent,
                  sources: [...sources],
                  workflowPath,
                  rawApiResponse: event.data
                };
              }
              return newMessages;
            });
            
            // Log usage statistics if available
            if (event.data?.usage) {
              setDebugInfo(prev => prev + `Usage: ${JSON.stringify(event.data.usage)}\n`);
            }
            break;

          default:
            // Log unknown event types
            setDebugInfo(prev => prev + `Unknown event type: ${event.type}\n`);
            break;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown streaming error';
      setError(`Streaming error: ${errorMessage}`);
      setDebugInfo(prev => prev + `Streaming error details: ${JSON.stringify(err)}\n`);
      
      // Update the bot message with an error
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'bot') {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            content: `Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants ou contactez directement l'IAE Lyon 3.\n\nErreur technique: ${errorMessage}`
          };
        }
        return newMessages;
      });
      
      // Reset workflow steps
      resetWorkflowSteps();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle key press in the input field
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * Format a timestamp for display
   */
  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">IAE Lyon 3 - Assistant (Streaming Mode)</h2>
        {isLoading && (
          <div className="flex items-center space-x-2">
            <Loader2 className="animate-spin w-5 h-5" />
            <span>Chargement...</span>
          </div>
        )}
      </div>

      {/* Workflow Steps */}
      <div className="bg-gray-50 p-3 border-b flex items-center justify-center space-x-4">
        {workflowSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <div className="h-px w-8 bg-gray-300"></div>
            )}
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${step.status === 'pending' ? 'bg-gray-200 text-gray-500' : 
                  step.status === 'active' ? 'bg-blue-100 text-blue-600 animate-pulse' : 
                  'bg-green-100 text-green-600'}
              `}>
                <span>{step.icon}</span>
              </div>
              <span className="text-xs mt-1 font-medium">{step.name}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-2 rounded">
          <p className="font-medium">Erreur</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start space-x-3 max-w-4xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`p-2 rounded-full ${message.type === 'user' ? 'bg-blue-600' : 'bg-gray-100'}`}>
                {message.type === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className={`p-4 rounded-2xl ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
                <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                  <ReactMarkdown>{message.content || 'Chargement...'}</ReactMarkdown>
                </div>
                
                {/* Sources */}
                {message.type === 'bot' && message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 font-medium">Sources:</p>
                    <ul className="mt-1 space-y-1">
                      {message.sources.map((source, i) => (
                        <li key={i} className="text-xs flex items-center text-blue-600">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          {source.title || source.url}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Workflow Path */}
                {message.type === 'bot' && message.workflowPath && message.workflowPath.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-medium">Workflow: </span>
                    {message.workflowPath.join(' → ')}
                  </div>
                )}
                
                <div className="mt-1 text-xs text-gray-400">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <textarea
            className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Tapez votre message ici..."
            rows={2}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          <button
            className={`px-4 py-2 rounded-lg flex items-center justify-center ${
              isLoading || !inputMessage.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Debug Information */}
      {showDebug && debugInfo && (
        <div className="border-t p-4 bg-gray-50">
          <h3 className="font-medium text-sm text-gray-700 mb-2">Debug Information</h3>
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
            {debugInfo}
          </pre>
        </div>
      )}

      {/* API Logs */}
      {showLogs && logs.length > 0 && (
        <div className="border-t p-4 bg-gray-50">
          <h3 className="font-medium text-sm text-gray-700 mb-2">API Logs</h3>
          <div className="text-xs bg-gray-100 p-3 rounded overflow-y-auto max-h-40">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamingChatWindow;
