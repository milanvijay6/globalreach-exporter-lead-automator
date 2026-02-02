import React from 'react';
import { Message, Channel, MessageStatus } from '../types';
import { ThumbsUp, ThumbsDown, Phone, Mail, MessageSquare, Clock, Check, AlertTriangle, MailOpen } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onMessageFeedback?: (messageId: string, isHelpful: boolean) => void;
}

const ChannelIcon = ({ channel }: { channel: Channel }) => {
  switch(channel) {
    case Channel.WHATSAPP: return <Phone className="w-3 h-3 text-green-600" />;
    case Channel.WECHAT: return <MessageSquare className="w-3 h-3 text-emerald-600" />;
    case Channel.EMAIL: return <Mail className="w-3 h-3 text-blue-600" />;
    default: return <Phone className="w-3 h-3 text-slate-400" />;
  }
};

const StatusIndicator = ({ status, channel }: { status?: MessageStatus, channel: Channel }) => {
  if (!status) return null;

  if (channel === Channel.EMAIL) {
    if (status === MessageStatus.SENDING) return <Clock className="w-3 h-3 text-slate-400" />;
    if (status === MessageStatus.READ) return <span className="flex items-center gap-0.5 text-indigo-600" title="Opened"><MailOpen className="w-3 h-3" /> Opened</span>;
    return <span className="text-[10px] text-slate-400 capitalize">{status}</span>;
  }

  switch (status) {
    case MessageStatus.SENDING:
      return <Clock className="w-3 h-3 text-slate-400" />;
    case MessageStatus.SENT:
      return <div title="Sent to server"><Check className="w-3 h-3 text-slate-400" /></div>;
    case MessageStatus.DELIVERED:
      return <div className="flex -space-x-1" title="Delivered"><Check className="w-3 h-3 text-slate-400" /><Check className="w-3 h-3 text-slate-400" /></div>;
    case MessageStatus.READ:
      return <div className="flex -space-x-1" title="Read"><Check className="w-3 h-3 text-blue-500" /><Check className="w-3 h-3 text-blue-500" /></div>;
    case MessageStatus.FAILED:
      return <div title="Failed"><AlertTriangle className="w-3 h-3 text-red-500" /></div>;
    default:
      return null;
  }
};

const getBubbleClass = (sender: 'agent' | 'importer' | 'system') => {
  if (sender === 'agent') return 'bg-indigo-500 text-white';
  if (sender === 'system') return 'bg-slate-200 text-slate-700 text-center text-xs';
  return 'bg-white border border-slate-200 text-slate-800';
};

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, onMessageFeedback }) => {
  return (
    <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${message.sender === 'agent' ? 'self-end items-end' : (message.sender === 'system' ? 'self-center' : 'self-start items-start')}`}>
      <div className={`px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed relative ${getBubbleClass(message.sender)} group`}>
        {message.content}
        
        {/* Message Feedback Controls for Agent Messages */}
        {message.sender === 'agent' && onMessageFeedback && (
          <div className="absolute -left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button 
              onClick={() => onMessageFeedback(message.id, false)}
              className={`p-1 rounded-full hover:bg-red-50 ${message.feedback === 'unhelpful' ? 'text-red-500 bg-red-50' : 'text-slate-300 hover:text-red-400'}`}
              title="Mark as unhelpful"
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
            <button 
              onClick={() => onMessageFeedback(message.id, true)}
              className={`p-1 rounded-full hover:bg-green-50 ${message.feedback === 'helpful' ? 'text-green-500 bg-green-50' : 'text-slate-300 hover:text-green-400'}`}
              title="Mark as helpful"
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {message.sender !== 'system' && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1 font-medium">
          <div className="flex items-center gap-1 opacity-80">
            <ChannelIcon channel={message.channel} />
            <span className="capitalize">{message.channel}</span>
          </div>
          <span>•</span>
          <span>{new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          {message.sender === 'agent' && message.status && (
            <>
              <span>•</span>
              <StatusIndicator status={message.status} channel={message.channel} />
            </>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if message content, feedback, or status changes
  return (
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.feedback === nextProps.message.feedback &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.timestamp === nextProps.message.timestamp
  );
});

MessageBubble.displayName = 'MessageBubble';










