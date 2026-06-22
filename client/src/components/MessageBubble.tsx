import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { ChatMessage } from '../types';
import { TypingIndicator } from './TypingIndicator';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isEmpty = message.content === '' && message.streaming;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-sm shrink-0 mt-1">
          🤖
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-brand-500 text-white rounded-tr-sm'
            : 'bg-stone-100 text-stone-800 rounded-tl-sm'
        }`}
      >
        {isEmpty ? (
          <TypingIndicator />
        ) : (
          <>
            <ReactMarkdown
              rehypePlugins={[rehypeSanitize]}
              components={{
                p: (props) => <p className="mb-1 last:mb-0">{props.children}</p>,
                strong: (props) => <strong className="font-semibold">{props.children}</strong>,
                ul: (props) => <ul className="list-disc list-inside space-y-0.5 my-1">{props.children}</ul>,
                ol: (props) => <ol className="list-decimal list-inside space-y-0.5 my-1">{props.children}</ol>,
                li: (props) => <li>{props.children}</li>,
                code: (props) => (
                  <code className="bg-black/10 rounded px-1 text-xs font-mono">{props.children}</code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse" aria-hidden="true" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
