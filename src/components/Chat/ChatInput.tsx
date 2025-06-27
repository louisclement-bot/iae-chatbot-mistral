import React from 'react';
import { Send, Loader2 } from 'lucide-react';

/**
 * Props for the ChatInput component
 */
export interface ChatInputProps {
  /** Current value of the input message */
  inputMessage: string;
  /** Callback for when the input message changes */
  onInputChange: (message: string) => void;
  /** Callback for when the send button is clicked or Enter is pressed */
  onSendMessage: () => void;
  /** Whether the input and send button should be disabled (e.g., when loading) */
  isLoading: boolean;
}

/**
 * ChatInput component
 * 
 * Provides the message input area with a textarea and a send button.
 * Handles user input, keyboard events, and displays loading states.
 */
const ChatInput: React.FC<ChatInputProps> = ({
  inputMessage,
  onInputChange,
  onSendMessage,
  isLoading,
}) => {
  /**
   * Handle key press in the input field
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="p-6 border-t border-gray-100 bg-gray-50">
      <div className="flex space-x-4">
        <div className="flex-1">
          <textarea
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Posez votre question sur l'IAE Lyon 3..."
            className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            rows={2}
            disabled={isLoading}
          />
        </div>
        <button
          onClick={onSendMessage}
          disabled={!inputMessage.trim() || isLoading}
          className={`px-6 py-4 rounded-xl flex items-center justify-center ${
            isLoading || !inputMessage.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        ✨ Recherche intelligente limitée au domaine iae.univ-lyon3.fr
      </p>
    </div>
  );
};

export default ChatInput;
