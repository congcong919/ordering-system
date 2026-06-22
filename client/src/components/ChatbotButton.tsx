import { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatPanel } from './ChatPanel';
import { InputBar } from './InputBar';

export function ChatbotButton() {
  const [open, setOpen] = useState(false);
  const { messages, isStreaming, sendMessage, stopStreaming, newChat } = useChat();

  // Keep a stable ref so the event listener always calls the latest sendMessage
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; });

  useEffect(() => {
    const handleOpen = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent<{ mode?: string }>).detail;
      if (detail?.mode === 'reservation') {
        setTimeout(() => sendMessageRef.current("I'd like to make a table reservation"), 50);
      }
    };
    window.addEventListener('open-chatbot', handleOpen);
    return () => window.removeEventListener('open-chatbot', handleOpen);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Chat panel */}
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden flex flex-col max-h-[560px]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-500 to-amber-400 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm">🤖</div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">OrderUp Assistant</p>
                <p className="text-brand-100 text-xs">AI-powered help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={newChat}
                aria-label="New chat"
                title="New chat"
                className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Message list */}
          <ChatPanel messages={messages} isStreaming={isStreaming} onQuickAction={sendMessage} />

          {/* Input */}
          <InputBar onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} />
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open AI assistant"
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          open
            ? 'bg-stone-700 hover:bg-stone-800'
            : 'bg-gradient-to-br from-brand-500 to-amber-400 hover:from-brand-600 hover:to-amber-500 shadow-brand-500/40'
        }`}
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>
    </div>
  );
}
