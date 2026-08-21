import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './ui';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
interface PendingConfirm extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

let pending: PendingConfirm | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return pending;
}

/** In-app iOS-style confirmation. Resolves true on confirm, false on cancel/dismiss. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (pending) pending.resolve(false); // supersede any open sheet
    pending = { ...opts, resolve };
    emit();
  });
}

function close(result: boolean) {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(result);
}

export function ConfirmHost() {
  const p = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!p) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  if (typeof document === 'undefined' || !p) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => close(false)} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="confirm-sheet overflow-hidden rounded-3xl bg-white shadow-raise">
          <div className="px-5 py-4 text-center">
            <p className="text-base font-bold text-ink">{p.title}</p>
            {p.message && <p className="mt-1 text-sm leading-snug text-ink/60">{p.message}</p>}
          </div>
          <button
            onClick={() => close(true)}
            className={cx(
              'block w-full border-t border-black/5 px-5 py-3.5 text-center text-base font-bold active:bg-black/[0.03]',
              p.danger ? 'text-rose-600' : 'text-brand-700',
            )}
          >
            {p.confirmText ?? 'Confirm'}
          </button>
        </div>
        <button
          onClick={() => close(false)}
          className="confirm-sheet mt-2 block w-full rounded-3xl bg-white px-5 py-3.5 text-center text-base font-bold text-ink shadow-raise active:bg-black/[0.03]"
        >
          {p.cancelText ?? 'Cancel'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
