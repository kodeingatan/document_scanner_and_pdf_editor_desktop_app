import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ------------------------------- Buttons ------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-active)] disabled:bg-[var(--primary-disabled)] disabled:text-[var(--muted)]',
  secondary:
    'bg-[var(--canvas)] text-[var(--ink)] border border-[var(--hairline)] hover:bg-[var(--surface-soft)] disabled:text-[var(--muted)]',
  ghost: 'bg-transparent text-[var(--ink)] hover:bg-[var(--surface-card)]',
  subtle: 'bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)]',
  danger: 'bg-[var(--error)] text-white hover:brightness-95',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-5 text-[14px] gap-2',
  lg: 'h-11 px-6 text-[15px] gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading,
  block,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'focus-ring inline-flex select-none items-center justify-center rounded-md font-semibold transition-colors duration-100 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner size={14} /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.9} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  active,
  className,
  size = 32,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      style={{ width: size, height: size }}
      className={clsx(
        'focus-ring inline-flex items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-[var(--ink)] bg-[var(--surface-card)] text-[var(--ink)]'
          : 'border-transparent text-[var(--body-text)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]',
        className,
      )}
    >
      <Icon size={16} strokeWidth={1.9} />
    </button>
  );
}

/* -------------------------------- Inputs ------------------------------- */

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-[var(--muted)]">
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <p className="text-[11px] leading-4 text-[var(--muted-soft)]">{hint}</p> : null}
    </div>
  );
}

const controlClasses =
  'focus-ring w-full rounded-md border border-[var(--hairline)] bg-[var(--canvas)] px-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted-soft)] focus:border-[var(--ink)] disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} {...rest} className={clsx(controlClasses, 'h-10', className)} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} rows={3} {...rest} className={clsx(controlClasses, 'py-2 leading-5', className)} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} {...rest} className={clsx(controlClasses, 'h-10 appearance-none pr-8', className)}>
        {children}
      </select>
    );
  },
);

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  disabled,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--body-text)]">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={onReset}
        className="w-full cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={clsx('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'focus-ring relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors',
          checked ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-[var(--hairline)] bg-[var(--surface-strong)]',
        )}
      >
        <span
          className={clsx(
            'absolute top-[2px] h-[16px] w-[16px] rounded-full bg-[var(--canvas)] shadow-sm transition-all',
            checked ? 'left-[19px]' : 'left-[2px]',
          )}
        />
      </button>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-[13px] font-medium text-[var(--ink)]">{label}</span> : null}
          {description ? (
            <span className="text-[12px] leading-4 text-[var(--muted)]">{description}</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}

/* -------------------------------- Layout ------------------------------- */

export function Card({
  children,
  className,
  padded = true,
  interactive,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]',
        padded && 'p-5',
        interactive && 'cursor-pointer transition-shadow hover:shadow-soft',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-[var(--surface-card)] text-[var(--body-text)]',
    success: 'bg-[var(--success)]/12 text-[var(--success)]',
    warning: 'bg-[var(--warning)]/14 text-[#b45309] dark:text-[var(--warning)]',
    error: 'bg-[var(--error)]/12 text-[var(--error)]',
    info: 'bg-[var(--brand-accent)]/12 text-[var(--brand-accent)]',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--hairline)] bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
      {children}
    </kbd>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-middle"
      style={{ width: size, height: size, opacity: 0.7 }}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--hairline)] px-8 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--muted)]">
          <Icon size={22} strokeWidth={1.6} />
        </span>
      ) : null}
      <div>
        <p className="text-[14px] font-medium text-[var(--ink)]">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]', className)}>
      <div
        className="h-full rounded-full bg-[var(--ink)] transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children?: React.ReactNode;
}) {
  const tones = {
    info: 'border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/8 text-[var(--body-text)]',
    warning: 'border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[var(--body-text)]',
    error: 'border-[var(--error)]/30 bg-[var(--error)]/8 text-[var(--body-text)]',
    success: 'border-[var(--success)]/30 bg-[var(--success)]/8 text-[var(--body-text)]',
  };
  return (
    <div className={clsx('rounded-md border px-3 py-2.5 text-[12px] leading-5', tones[tone])}>
      {title ? <p className="mb-0.5 font-semibold text-[var(--ink)]">{title}</p> : null}
      {children}
    </div>
  );
}

/* -------------------------------- Modal -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-8 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'mt-6 w-full animate-scale-in rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] shadow-raised',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--hairline)] px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx('inline-flex rounded-pill bg-[var(--surface-soft)] p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'focus-ring rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
            value === tab.value
              ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-soft'
              : 'text-[var(--muted)] hover:text-[var(--ink)]',
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="ml-1.5 text-[11px] text-[var(--muted-soft)]">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx('flex rounded-md border border-[var(--hairline)] p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'focus-ring flex-1 rounded-[6px] px-2 py-1.5 text-[12px] font-medium transition-colors',
            value === option.value
              ? 'bg-[var(--surface-card)] text-[var(--ink)]'
              : 'text-[var(--muted)] hover:text-[var(--ink)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
