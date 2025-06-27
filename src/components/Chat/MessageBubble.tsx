import React from 'react';
import { Bot, User, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../../types';

/**
 * Props for the MessageBubble component
 */
export interface MessageBubbleProps {
  /** The message to display */
  message: Message;
  /** Optional className for styling */
  className?: string;
}

/**
 * MessageBubble component
 * 
 * Displays a single message in the chat, handling both user and bot messages
 * with different styling, markdown rendering, sources, and workflow paths.
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message, className = '' }) => {
  const isUser = message.type === 'user';

  /**
   * Format the timestamp for display
   */
  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${className}`}>
      <div className={`flex items-start space-x-3 max-w-4xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`p-2 rounded-full ${isUser ? 'bg-blue-600' : 'bg-gray-100'}`}>
          {isUser ? 
            <User className="w-5 h-5 text-white" /> : 
            <Bot className="w-5 h-5 text-blue-600" />
          }
        </div>
        <div className={`p-4 rounded-2xl ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
          <div className="text-sm leading-relaxed prose prose-sm max-w-none">
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="prose-headings:text-gray-800 prose-p:text-gray-800 prose-strong:text-gray-900 prose-em:text-gray-700 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-blockquote:border-l-blue-500 prose-blockquote:text-gray-700 prose-ul:text-gray-800 prose-ol:text-gray-800 prose-li:text-gray-800">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          {/* Workflow Path */}
          {!isUser && message.workflowPath && message.workflowPath.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">Workflow exécuté :</p>
              <div className="flex items-center space-x-2 flex-wrap">
                {message.workflowPath.map((step, index) => (
                  <div key={index} className="flex items-center space-x-1">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                      {step}
                    </span>
                    {index < message.workflowPath.length - 1 && (
                      <span className="text-gray-400 text-xs">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">Sources :</p>
              <div className="space-y-2">
                {message.sources.map((source, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <ExternalLink className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline truncate"
                    >
                      {source.title || source.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Timestamp */}
          <div className="text-xs opacity-70 mt-2">
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
