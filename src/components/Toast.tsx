import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cx } from './ui';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l());
}

/** Show a transient toast that springs up and auto-dismisses. */
export function toast(message: string, kind: ToastKind = 'success'): void {
  const id = nextId++;
  items = [...items, { id, message, kind }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 2600);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return items;
}

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};
const TONES: Record<ToastKind, string> = {
  success: 'text-brand-600',
  error: 'text-rose-600',
  info: 'text-ink/60',
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+90px)] z-50 flex flex-col items-center gap-2 px-4">
      {list.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className="toast-item pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border border-black/5 bg-white/95 px-4 py-2.5 text-sm font-semibold text-ink shadow-raise backdrop-blur-xl"
          >
            <Icon className={cx('h-4 w-4 shrink-0', TONES[t.kind])} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
