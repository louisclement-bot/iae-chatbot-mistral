/**
 * @file ChatPage Component
 * 
 * This is the main container component for the chat feature.
 * It orchestrates the chat functionality by:
 * - Managing conversation state
 * - Connecting to Mistral AI services
 * - Handling workflow execution
 * - Coordinating UI components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Search, Loader2 } from 'lucide-react';

// Types
import { 
  Message, 
  UserMessage, 
  BotMessage, 
  WorkflowStep, 
  AgentCollection,
  Agent,
  AgentConfig,
  StreamEvent,
  StreamEventType
} from '@types/index';

// Services
import { AgentService, createAgentService } from '@services/mistral/agentService';
import { ConversationService, createConversationService } from '@services/mistral/conversationService';
import { WorkflowCoordinator, WorkflowState } from '@services/workflow/workflowCoordinator';

// Components
import ChatWindow from '@components/Chat/ChatWindow';

// Config (agent definitions)
import { agentConfigs, configureHandoffs } from '@config/agents';

/**
 * Props for the ChatPage component
 */
export interface ChatPageProps {
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
 * ChatPage component
 * 
 * Smart container component that orchestrates the chat feature.
 */
const ChatPage: React.FC<ChatPageProps> = ({
  apiKey = process.env.REACT_APP_MISTRAL_API_KEY,
  apiBaseUrl = 'https://api.mistral.ai/v1',
  initialMessages = [],
  showDebug = false,
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
  
  // State for input and loading
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // State for agents and conversation
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentCollection>({
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

  // Service instances
  const [agentService, setAgentService] = useState<AgentService | null>(null);
  const [conversationService, setConversationService] = useState<ConversationService | null>(null);
  const [workflowCoordinator, setWorkflowCoordinator] = useState<WorkflowCoordinator | null>(null);
  
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
      const wfCoordinator = new WorkflowCoordinator(convSvc);

      setAgentService(agentSvc);
      setConversationService(convSvc);
      setWorkflowCoordinator(wfCoordinator);

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
   * Handle sending a message
   */
  const handleSendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || !workflowCoordinator || !agents.documentLibrary) return;

    const userMessage: UserMessage = {
      id: Date.now(),
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
      sources: []
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError('');
    
    // Reset workflow steps visual state
    setWorkflowSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

    // Create a placeholder for the bot's response
    const botMessageId = Date.now() + 1;
    const initialBotMessage: BotMessage = {
      id: botMessageId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
      sources: [],
      workflowPath: [],
      rawApiResponse: {}
    };
    setMessages(prev => [...prev, initialBotMessage]);

    try {
      const request = conversationId
        ? { conversationId, agentId: agents.documentLibrary.id, inputs: messageContent }
        : { agentId: agents.documentLibrary.id, inputs: messageContent };

      const result = await workflowCoordinator.executeWorkflow(
        request,
        'Document Library', // Initial agent name for workflow tracking
        (state: WorkflowState) => {
          // Update messages with accumulated content and sources
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.id === botMessageId) {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: state.accumulatedContent,
                sources: state.sources,
                workflowPath: state.workflowPath,
                rawApiResponse: state.rawEvents.find(e => e.type === StreamEventType.CONVERSATION_RESPONSE_DONE)?.data || {}
              };
            }
            return newMessages;
          });

          // Update workflow steps visual status
          setWorkflowSteps(prev => prev.map(step => {
            const isActive = state.currentAgent === step.name;
            const isCompleted = state.workflowPath.includes(step.name) && !isActive;
            return {
              ...step,
              status: isActive ? 'active' : (isCompleted ? 'completed' : 'pending')
            };
          }));

          // Update debug info
          if (showDebug) {
            setDebugInfo(JSON.stringify(state.rawEvents, null, 2));
          }
        }
      );

      if (result.success) {
        setConversationId(result.data.conversation_id);
        // Final update to messages with complete data from result
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.id === botMessageId) {
            newMessages[newMessages.length - 1] = {
              ...lastMessage,
              content: result.data.content,
              sources: result.data.sources,
              workflowPath: result.data.workflowPath,
              rawApiResponse: result.data.rawApiResponse
            };
          }
          return newMessages;
        });
      } else {
        throw result.error;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants ou contactez directement l'IAE Lyon 3.\n\nErreur technique: ${errorMessage}`);
      setDebugInfo(prev => prev + `Error details: ${JSON.stringify(err)}\n`);
      
      // Update the bot message with an error
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.id === botMessageId) {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            content: `Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants ou contactez directement l'IAE Lyon 3.\n\nErreur technique: ${errorMessage}`
          };
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      // Reset workflow steps visual state after processing
      setWorkflowSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
    }
  };
  
  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-blue-600">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-xl">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Assistant IAE Lyon 3</h1>
                <p className="text-gray-600">Intelligence artificielle • Recherche web spécialisée</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Search className="w-4 h-4" />
              <span>Powered by Mistral AI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {debugInfo && (
          <div className="mb-4 bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">🔍 Debug Info</h3>
            <div className="bg-white rounded-lg border border-blue-200 p-3 text-xs font-mono whitespace-pre-wrap text-gray-700 max-h-40 overflow-y-auto">
              {debugInfo}
            </div>
          </div>
        )}
        
        {/* Main Chat Window Component */}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          workflowSteps={workflowSteps}
          error={error}
          debugInfo={showDebug ? debugInfo : undefined}
          onSendMessage={handleSendMessage}
          inputMessage={inputMessage}
          onInputChange={setInputMessage}
          showWorkflow={true}
          showLogs={showLogs}
        />

        <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">🤖 Intégration Mistral AI activée</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-medium mb-1">Agent spécialisé</p>
              <p>Utilise l'API Mistral AI avec websearch pour des réponses précises et actualisées.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Recherche ciblée</p>
              <p>Recherche uniquement sur iae.univ-lyon3.fr grâce aux instructions avancées de l'agent.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Sources vérifiées</p>
              <p>Chaque réponse inclut les liens vers les pages sources officielles de l'IAE.</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-200">
            <p className="text-green-800 text-sm">
              ✅ <strong>API Mistral connectée</strong> - Agent: {agents.documentLibrary ? agents.documentLibrary.id.substring(0, 20) + '...' : 'En cours...'}
              {conversationId && <><br/>💬 Conversation: {conversationId.substring(0, 15)}...</>}
            </p>
          </div>
        </div>

        {showLogs && messages.some(m => m.type === 'bot' && m.rawApiResponse) && (
          <div className="mt-6 bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">📋 Logs API Workflow Agentic Mistral</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
              {messages.length > 0 ? (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    message.type === 'bot' && message.rawApiResponse && (
                      <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            🔍 Réponse API #{messages.filter(m => m.type === 'bot').indexOf(message) + 1} - {message.timestamp.toLocaleTimeString()}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {message.stepName || 'Workflow Agentic'}
                            </span>
                            {message.workflowPath && message.workflowPath.length > 0 && (
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                {message.workflowPath.join(' → ')}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Raw JSON */}
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <h4 className="text-xs font-semibold text-gray-800 mb-2">🔍 JSON Complet</h4>
                          <div className="bg-gray-900 rounded p-3 text-xs font-mono text-green-400 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                            {JSON.stringify(message.rawApiResponse, null, 2)}
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">Aucune réponse API disponible</p>
                  <p className="text-xs mt-1">Les réponses détaillées du workflow agentic Mistral apparaîtront ici</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
