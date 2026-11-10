import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

// ── Button ──────────────────────────────────────────────────
type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'grad text-white shadow-glow hover:brightness-110',
  soft: 'bg-raised text-fg border border-line/10 hover:border-line/20 hover:bg-raised/70',
  ghost: 'text-muted hover:bg-line/10 hover:text-fg',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
};
const SIZES = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-5 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  icon?: ReactNode;
}
export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition duration-150 hover:bg-line/10 hover:text-fg active:scale-90 disabled:opacity-40',
        active && 'bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Inputs ──────────────────────────────────────────────────
const fieldBase =
  'w-full rounded-xl border bg-raised/70 px-4 text-sm text-fg placeholder:text-muted/70 transition focus:outline-none focus:ring-4 disabled:opacity-60';
const fieldState = (error?: string) => (error ? 'border-danger/60 focus:border-danger focus:ring-danger/15' : 'border-line/10 hover:border-line/20 focus:border-accent/70 focus:ring-accent/15');

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps & { icon?: ReactNode; right?: ReactNode }>(
  ({ label, error, hint, icon, right, className, id, ...rest }, ref) => {
    const uid = id ?? rest.name;
    return (
      <div className={className}>
        {label && <label htmlFor={uid} className="mb-1.5 block text-sm font-medium text-fg/90">{label}</label>}
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
          <input ref={ref} id={uid} aria-invalid={!!error} className={clsx(fieldBase, fieldState(error), 'h-11', icon && 'pl-10', right && 'pr-11')} {...rest} />
          {right && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{right}</span>}
        </div>
        {error ? <p className="mt-1.5 text-xs text-danger" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(({ label, error, hint, className, id, ...rest }, ref) => {
  const uid = id ?? rest.name;
  return (
    <div className={className}>
      {label && <label htmlFor={uid} className="mb-1.5 block text-sm font-medium text-fg/90">{label}</label>}
      <textarea ref={ref} id={uid} aria-invalid={!!error} className={clsx(fieldBase, fieldState(error), 'min-h-[88px] resize-y py-3')} {...rest} />
      {error ? <p className="mt-1.5 text-xs text-danger" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
});
Textarea.displayName = 'Textarea';

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-sm font-medium text-fg/90">{label}</label>}
      <div className="relative">
        <select className={clsx(fieldBase, fieldState(), 'h-11 cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed')} {...rest}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50', checked ? 'grad' : 'bg-line/20')}
    >
      <span className={clsx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-raised p-1" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('relative inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition', value === o.value ? 'text-white' : 'text-muted hover:text-fg')}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="grad absolute inset-0 rounded-lg shadow-glow" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span className="relative z-10 inline-flex items-center gap-1.5">{o.icon}{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx('relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition', value === t.value ? 'text-fg' : 'text-muted hover:text-fg')}
        >
          {value === t.value && <motion.span layoutId="tabs-pill" className="absolute inset-0 rounded-xl bg-raised" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{t.label}</span>
          {!!t.count && <span className="relative grad rounded-full px-1.5 text-[11px] leading-5 text-white">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Modal & overlay ─────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' }[size];
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className={clsx('relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line/10 bg-surface shadow-soft sm:rounded-3xl', width)}
          >
            {title && (
              <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-5">
                <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
                <IconButton label="Закрыть" onClick={onClose} className="-mr-2"><X className="h-5 w-5" /></IconButton>
              </div>
            )}
            <div className="safe-b min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Плавающее меню в точке экрана (контекстное меню сообщения, меню профиля). */
export function FloatingMenu({ anchor, onClose, children, width = 220 }: { anchor: { x: number; y: number } | null; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const h = ref.current.offsetHeight;
    setPos({ left: Math.max(8, Math.min(anchor.x, window.innerWidth - width - 8)), top: Math.max(8, Math.min(anchor.y, window.innerHeight - h - 8)) });
  }, [anchor, width]);
  useEffect(() => {
    if (!anchor) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);
  if (!anchor) return null;
  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      style={{ left: pos?.left ?? anchor.x, top: pos?.top ?? anchor.y, width, visibility: pos ? 'visible' : 'hidden' }}
      className="glass fixed z-[60] origin-top-left rounded-2xl p-1.5 shadow-soft"
      role="menu"
    >
      {children}
    </motion.div>,
    document.body,
  );
}

export function MenuItem({ icon, children, danger, onClick }: { icon?: ReactNode; children: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className={clsx('flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition hover:bg-line/10', danger ? 'text-danger' : 'text-fg')}>
      {icon && <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </button>
  );
}

// ── Состояния ───────────────────────────────────────────────
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('h-5 w-5 animate-spin text-muted', className)} />;

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('relative overflow-hidden rounded-xl bg-line/10', className)}><div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-line/10 to-transparent" /></div>;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-raised text-accent">
        <div className="grad absolute inset-0 rounded-3xl opacity-15 blur-xl" />
        <span className="relative [&>svg]:h-9 [&>svg]:w-9">{icon}</span>
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {text && <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const Badge = ({ n, className }: { n: number; className?: string }) =>
  n > 0 ? <span className={clsx('grad inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5 text-white', className)}>{n > 99 ? '99+' : n}</span> : null;

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Row({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {text && <p className="mt-0.5 text-sm text-muted">{text}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
