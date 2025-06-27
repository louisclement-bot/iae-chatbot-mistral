/**
 * @file ChatWindow Component
 * 
 * This component renders the main chat interface, including:
 * - Message history display
 * - User input area
 * - Send button
 * - Loading indicators
 * - Workflow visualization
 */

import React, { useRef, useEffect } from 'react';
import { Loader2, Bot } from 'lucide-react';
import { Message, WorkflowStep, MessageSource } from '@types/index';

// Import the new components
import MessageBubble from './MessageBubble';
import WorkflowIndicator from './WorkflowIndicator';
import ChatInput from './ChatInput';

/**
 * Props for the ChatWindow component
 */
export interface ChatWindowProps {
  /** List of messages in the conversation */
  messages: Message[];
  
  /** Whether a message is currently being sent/processed */
  isLoading: boolean;
  
  /** Current workflow steps and their status */
  workflowSteps: WorkflowStep[];
  
  /** Error message to display (if any) */
  error?: string;
  
  /** Debug information to display (if any) */
  debugInfo?: string;
  
  /** Callback when user sends a message */
  onSendMessage: (message: string) => Promise<void>;
  
  /** Current value of the input message */
  inputMessage: string;
  
  /** Callback for when the input message changes */
  onInputChange: (message: string) => void;
  
  /** Optional class name for styling */
  className?: string;
  
  /** Whether to show the API logs panel */
  showLogs?: boolean;
  
  /** Whether to show the workflow indicator */
  showWorkflow?: boolean;
  
  /** Callback when a source link is clicked */
  onSourceClick?: (source: MessageSource) => void;
}

/**
 * ChatWindow component
 * 
 * Displays the chat interface with messages, input field, and workflow visualization.
 * Uses MessageBubble, WorkflowIndicator, and ChatInput components.
 */
const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  workflowSteps,
  error,
  debugInfo,
  onSendMessage,
  inputMessage,
  onInputChange,
  className = '',
  showLogs = true,
  showWorkflow = true,
  onSourceClick
}) => {
  // Ref for scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  /**
   * Scroll to the bottom of the message list
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  /**
   * Effect to scroll to bottom when messages change
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  /**
   * Handle sending a message
   */
  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      await onSendMessage(inputMessage);
    }
  };
  
  return (
    <div className={`bg-white rounded-2xl shadow-xl overflow-hidden ${className}`}>
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded">
          <p className="font-medium">Erreur</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {/* Debug information */}
      {debugInfo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 m-4 rounded">
          <p className="font-medium">Debug Info</p>
          <pre className="text-xs whitespace-pre-wrap">{debugInfo}</pre>
        </div>
      )}
      
      {/* Messages container */}
      <div className="h-[600px] overflow-y-auto p-6 space-y-6">
        {/* Map through messages and render MessageBubble for each */}
        {messages.map((message) => (
          <MessageBubble 
            key={message.id} 
            message={message} 
          />
        ))}
        
        {/* Loading indicator */}
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
                      Exécution du workflow agentic...
                    </span>
                  </div>
                  
                  {/* Workflow indicator */}
                  {showWorkflow && (
                    <WorkflowIndicator workflowSteps={workflowSteps} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Reference for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area using ChatInput component */}
      <ChatInput
        inputMessage={inputMessage}
        onInputChange={onInputChange}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
};

export default ChatWindow;
