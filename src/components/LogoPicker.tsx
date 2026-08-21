import { useId, useState, type ChangeEvent } from 'react';
import { fileToLogoDataUrl } from '../lib/image';
import { cx } from './ui';

export default function LogoPicker({
  value,
  onChange,
  size = 48,
  fallbackColor = '#166534',
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  size?: number;
  fallbackColor?: string;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToLogoDataUrl(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <img
          src={value}
          alt="Team logo"
          className="rounded-lg object-cover ring-1 ring-green-200"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-lg text-white"
          style={{ width: size, height: size, backgroundColor: fallbackColor }}
          aria-hidden
        >
          🚩
        </div>
      )}
      <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <label
        htmlFor={inputId}
        className={cx(
          'cursor-pointer rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-900 hover:bg-green-200',
          busy && 'opacity-50',
        )}
      >
        {busy ? 'Loading…' : value ? 'Change' : 'Upload logo'}
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-xs font-medium text-red-500"
        >
          Remove
        </button>
      )}
    </div>
  );
}
