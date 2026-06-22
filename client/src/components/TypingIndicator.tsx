export function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center py-0.5" aria-label="Assistant is typing">
      <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}
