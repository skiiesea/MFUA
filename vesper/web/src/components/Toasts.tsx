import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useUi } from '../store/ui';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-3 safe-t sm:inset-x-auto sm:right-0 sm:items-end sm:p-5" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-3.5 shadow-soft"
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            <span className={clsx('mt-0.5', t.kind === 'success' && 'text-ok', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-accent')}>
              {t.kind === 'success' ? <CheckCircle2 className="h-5 w-5" /> : t.kind === 'error' ? <AlertCircle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium leading-snug">{t.text}</p>
              {t.action && (
                <button onClick={() => { t.action!.run(); dismiss(t.id); }} className="mt-1.5 text-sm font-semibold text-accent hover:underline">
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Закрыть" className="text-muted transition hover:text-fg"><X className="h-4 w-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
