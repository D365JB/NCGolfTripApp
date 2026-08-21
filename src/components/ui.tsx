import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { Lock } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
  ghost: 'text-brand-700 hover:bg-brand-50',
  outline: 'border border-brand-200 bg-white text-brand-800 hover:bg-brand-50',
  danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
};
const sizeClasses: Record<Size, string> = {
  sm: 'gap-1 px-3 py-1.5 text-xs',
  md: 'gap-1.5 px-4 py-2.5 text-sm',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 disabled:pointer-events-none disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  interactive,
}: {
  className?: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-card backdrop-blur-sm',
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raise',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink/60">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, props.className)} />;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink/55">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

type Tone = 'brand' | 'gold' | 'neutral' | 'danger';
const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-800',
  gold: 'bg-gold-400/20 text-gold-600',
  neutral: 'bg-black/5 text-ink/60',
  danger: 'bg-rose-100 text-rose-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 px-4 py-10 text-center text-sm text-ink/55">
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-black/[0.07]', className)} />;
}

export function AdminOnly({ title = 'Admin only', message }: { title?: string; message?: string }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-black/5 bg-white p-8 text-center shadow-card">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-sand-100 text-ink/50">
        <Lock className="h-5 w-5" />
      </span>
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink/55">
        {message ??
          'This section is managed by the event admin. Unlock admin from the account menu (top-right) to make changes.'}
      </p>
    </div>
  );
}
