import { useRef, useState } from 'react';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function InputBar({ onSend, onStop, isStreaming }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-3 pb-3 shrink-0">
      <div className="flex items-end gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the menu, book a table…"
          disabled={isStreaming}
          rows={1}
          aria-label="Message input"
          className="flex-1 bg-transparent text-sm text-stone-800 placeholder-stone-400 outline-none resize-none"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            aria-label="Stop"
            className="text-stone-500 hover:text-stone-700 transition p-0.5 shrink-0"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            aria-label="Send"
            className="text-brand-500 hover:text-brand-600 disabled:opacity-30 transition shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
