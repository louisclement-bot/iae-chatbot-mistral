/**
 * @file ChatPage Component
 * 
 * This is the main container component for the chat feature.
 * It orchestrates the chat functionality by:
 * - Managing conversation state
 * - Connecting to Mistral AI services
 * - Handling workflow execution
 * - Coordinating UI components
 * 
 * Note: This is a placeholder implementation for Phase 1 (TypeScript structure).
 * The actual implementation will be completed in Phases 4-6.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Send, Bot, User, ExternalLink, Search, Loader2 } from 'lucide-react';

// Types
import { 
  Message, 
  UserMessage, 
  BotMessage, 
  WorkflowStep, 
  WorkflowResult,
  AgentCollection,
  MessageSource
} from '@types/index';

// Services (to be implemented in Phase 2)
import { AgentService } from '@services/mistral/agentService';
import { ConversationService } from '@services/mistral/conversationService';

// Components (to be implemented in Phase 5)
// import { ChatWindow } from '@components/Chat/ChatWindow';
// import { WorkflowIndicator } from '@components/Chat/WorkflowIndicator';
// import { ApiLogsPanel } from '@components/Chat/ApiLogsPanel';

// Config (agent definitions)
import { agentConfigs, configureHandoffs } from '@config/agents';

// Workflow engine (to be implemented in Phase 4)
// import { executeWorkflow } from '@services/workflow/workflowEngine';

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
  const [agentId, setAgentId] = useState<string | null>(null);
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
  
  /**
   * Initialize services
   * 
   * TODO: Phase 2 - Replace with actual service initialization
   */
  const initializeServices = useCallback(async () => {
    if (!apiKey) {
      setError('API key is not configured. Please set REACT_APP_MISTRAL_API_KEY in .env');
      return;
    }
    
    try {
      // TODO: Phase 2 - Initialize AgentService and ConversationService
      // const agentService = new AgentService(apiKey, apiBaseUrl);
      // const conversationService = new ConversationService(apiKey, apiBaseUrl);
      
      // TODO: Phase 2 - Create or retrieve agents
      // const agentIds = {
      //   documentLibrary: '...',
      //   websearch: '...',
      //   docQA: '...'
      // };
      
      // TODO: Phase 2 - Configure handoffs between agents
      // const configuredAgents = configureHandoffs(agentIds);
      
      // TODO: Phase 2 - Set agent state
      // setAgents({
      //   documentLibrary: { ...configuredAgents.documentLibrary, id: agentIds.documentLibrary },
      //   websearch: { ...configuredAgents.websearch, id: agentIds.websearch },
      //   docQA: { ...configuredAgents.docQA, id: agentIds.docQA }
      // });
      
      // Set default agent
      // setAgentId(agentIds.documentLibrary);
      
      if (showDebug) {
        setDebugInfo('Services initialized successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to initialize services: ${errorMessage}`);
      if (showDebug) {
        setDebugInfo(`Error details: ${JSON.stringify(error)}`);
      }
    }
  }, [apiKey, apiBaseUrl, showDebug]);
  
  /**
   * Initialize services on component mount
   */
  useEffect(() => {
    initializeServices().catch(console.error);
  }, [initializeServices]);
  
  /**
   * Update workflow step status
   * 
   * @param stepId - ID of the step to update
   * @param status - New status for the step
   */
  const updateWorkflowStep = (stepId: number, status: 'pending' | 'active' | 'completed') => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };
  
  /**
   * Execute the workflow for a user message
   * 
   * TODO: Phase 4 - Replace with workflowEngine.executeWorkflow
   * 
   * @param userMessage - Message from the user
   * @returns Workflow result with response content and metadata
   */
  const executeWorkflow = async (userMessage: string): Promise<WorkflowResult> => {
    // TODO: Phase 4 - Implement workflow execution using the workflow engine
    // return await workflowEngine.executeWorkflow(userMessage, {
    //   agentService,
    //   conversationService,
    //   agents,
    //   updateWorkflowStep
    // });
    
    // Placeholder implementation
    throw new Error('Not implemented - Phase 4');
  };
  
  /**
   * Handle sending a message
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

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

    try {
      // TODO: Phase 4 - Use workflow engine to execute the workflow
      // const response = await executeWorkflow(inputMessage);
      
      // TODO: Phase 3 - Use conversationService with streaming
      // const stream = await conversationService.startStream({
      //   agentId: agents.documentLibrary?.id || '',
      //   inputs: inputMessage
      // });
      
      // TODO: Phase 3 - Handle streaming events
      // for await (const chunk of stream) {
      //   // Handle different event types
      //   // Update UI based on events
      // }
      
      // Placeholder for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const botMessage: BotMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'This is a placeholder response. The actual implementation will be added in Phase 3-4.',
        timestamp: new Date(),
        sources: [],
        workflowPath: ['Document Library'],
        stepName: 'Placeholder'
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const errorBotMessage: BotMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants ou contactez directement l'IAE Lyon 3.\n\nErreur technique: ${errorMessage}`,
        timestamp: new Date(),
        sources: []
      };
      
      setMessages(prev => [...prev, errorBotMessage]);
      
      if (showDebug) {
        setDebugInfo(`Error details: ${JSON.stringify(error)}`);
      }
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
  
  /**
   * Handle clicking on a source link
   */
  const handleSourceClick = (source: MessageSource) => {
    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer');
    }
  };
  
  // TODO: Phase 6 - Replace with Zustand store
  // const {
  //   messages,
  //   isLoading,
  //   workflowSteps,
  //   error,
  //   debugInfo,
  //   sendMessage,
  //   updateWorkflowStep
  // } = useChatStore();
  
  // TODO: Phase 5 - Replace with modular components
  // return (
  //   <div className={`chat-page ${className}`}>
  //     <ChatWindow
  //       messages={messages}
  //       isLoading={isLoading}
  //       workflowSteps={workflowSteps}
  //       error={error}
  //       debugInfo={debugInfo}
  //       onSendMessage={handleSendMessage}
  //       showWorkflow={true}
  //       showLogs={showLogs}
  //       onSourceClick={handleSourceClick}
  //     />
  //     
  //     {showLogs && (
  //       <ApiLogsPanel
  //         messages={messages.filter(m => m.type === 'bot' && m.rawApiResponse)}
  //       />
  //     )}
  //   </div>
  // );
  
  // Placeholder implementation for Phase 1
  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 ${className}`}>
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
        
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="h-[600px] overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start space-x-3 max-w-4xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`p-2 rounded-full ${message.type === 'user' ? 'bg-blue-600' : 'bg-gray-100'}`}>
                    {message.type === 'user' ? 
                      <User className="w-5 h-5 text-white" /> : 
                      <Bot className="w-5 h-5 text-blue-600" />
                    }
                  </div>
                  <div className={`p-4 rounded-2xl ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                      {message.content}
                    </div>
                    <div className="text-xs opacity-70 mt-2">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3 max-w-4xl">
                  <div className="p-2 rounded-full bg-gray-100">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">
                          {agents.documentLibrary ? 'Exécution du workflow agentic...' : 'Initialisation des agents Mistral...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50">
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Posez votre question sur l'IAE Lyon 3..."
                  className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={2}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ✨ Recherche intelligente limitée au domaine iae.univ-lyon3.fr
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
