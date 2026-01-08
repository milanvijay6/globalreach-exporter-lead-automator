import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { getQueuedMessagesCount, getQueuedMessages } from '../services/backgroundSyncService';

interface MessageQueueIndicatorProps {
  className?: string;
}

/**
 * Message Queue Indicator
 * Shows count of queued messages waiting to be sent
 */
const MessageQueueIndicator: React.FC<MessageQueueIndicatorProps> = ({ className = '' }) => {
  const [queuedCount, setQueuedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<any[]>([]);

  useEffect(() => {
    const updateQueueCount = async () => {
      const count = await getQueuedMessagesCount();
      setQueuedCount(count);
      
      if (count > 0) {
        const messages = await getQueuedMessages();
        setQueuedMessages(messages);
      }
    };

    // Update immediately
    updateQueueCount();

    // Update every 5 seconds
    const interval = setInterval(updateQueueCount, 5000);

    return () => clearInterval(interval);
  }, []);

  if (queuedCount === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-3 max-w-sm">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="font-medium text-yellow-800">
            {queuedCount} message{queuedCount !== 1 ? 's' : ''} queued
          </span>
        </button>

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-yellow-200">
            <p className="text-sm text-yellow-700 mb-2">
              Messages will be sent when network is available.
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {queuedMessages.slice(0, 5).map((msg) => (
                <div key={msg.messageId} className="text-xs text-yellow-600 truncate">
                  To: {msg.to} - {msg.content.substring(0, 30)}...
                </div>
              ))}
              {queuedMessages.length > 5 && (
                <div className="text-xs text-yellow-600">
                  +{queuedMessages.length - 5} more...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageQueueIndicator;

