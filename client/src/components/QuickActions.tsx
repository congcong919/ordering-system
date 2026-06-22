const QUICK_ACTIONS = [
  { label: "Today's Specials", prompt: "What are today's specials?" },
  { label: 'View Menu', prompt: 'Show me the full menu' },
  { label: 'Book a Table', prompt: "I'd like to book a table" },
  { label: 'Check My Order', prompt: "I'd like to check on my order" },
  { label: 'Opening Hours', prompt: 'What are your opening hours?' },
] as const;

interface Props {
  onAction: (prompt: string) => void;
  disabled: boolean;
}

export function QuickActions({ onAction, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="Quick actions">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          disabled={disabled}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-brand-300 transition disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
