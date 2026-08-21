import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Progressive enhancement: offers "Install" on supported browsers, or the manual
// Share -> Add to Home Screen hint on iOS. Hidden once installed or dismissed.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('cc:installDismissed') === '1');

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const nav = navigator as Navigator & { standalone?: boolean };
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isStandalone || dismissed) return null;
  if (!deferred && !isIOS) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem('cc:installDismissed', '1');
    } catch {
      /* ignore */
    }
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    close();
  };

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
      <Download className="h-4 w-4 shrink-0 text-brand-600" />
      <p className="flex-1 font-semibold text-brand-800">
        {isIOS
          ? 'Add to Home Screen (Share → Add to Home Screen) for offline use and the most reliable storage.'
          : 'Install the app for offline use and the most reliable storage.'}
      </p>
      {deferred && (
        <button onClick={install} className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 font-bold text-white">
          Install
        </button>
      )}
      <button onClick={close} aria-label="Dismiss">
        <X className="h-4 w-4 text-ink/40" />
      </button>
    </div>
  );
}
