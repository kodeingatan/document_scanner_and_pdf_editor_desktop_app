import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '../store/toast';

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const tones = {
  success: 'border-[var(--success)]/30 text-[var(--success)]',
  error: 'border-[var(--error)]/30 text-[var(--error)]',
  warning: 'border-[var(--warning)]/40 text-[var(--warning)]',
  info: 'border-[var(--brand-accent)]/30 text-[var(--brand-accent)]',
};

export function Toasts() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[60] flex w-[340px] flex-col gap-2">
      {items.map((item) => {
        const Icon = icons[item.tone];
        return (
          <div
            key={item.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-[var(--canvas)] px-3.5 py-3 shadow-raised animate-fade-in',
              tones[item.tone],
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[var(--ink)]">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 break-words text-[11px] leading-4 text-[var(--muted)]">{item.description}</p>
              ) : null}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="text-[var(--muted-soft)] hover:text-[var(--ink)]"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
