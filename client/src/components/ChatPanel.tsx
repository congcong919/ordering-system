import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { QuickActions } from './QuickActions';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onQuickAction: (prompt: string) => void;
}

export function ChatPanel({ messages, isStreaming, onQuickAction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="text-4xl">🍽️</span>
          <p className="text-stone-500 text-sm">How can I help you today?</p>
          <QuickActions onAction={onQuickAction} disabled={isStreaming} />
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
