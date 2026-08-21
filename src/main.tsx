import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { seedIfEmpty } from './db/seed';
import { recoverFromLocalIfEmpty, startAutoSnapshot } from './services/resilience';
import { initOutdoor, initTheme } from './lib/prefs';

// Apply the saved outdoor (high-contrast) setting before first paint.
initOutdoor();
initTheme();

// Ask the browser to keep our IndexedDB data (guards multi-day scores against eviction).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage
    .persisted()
    .then((granted) => (granted ? undefined : navigator.storage.persist()))
    .catch(() => {});
}

async function boot() {
  // If the database was cleared/corrupted but a local snapshot survives, restore it before render.
  await recoverFromLocalIfEmpty().catch(() => false);
  await seedIfEmpty().catch(() => {});

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );

  startAutoSnapshot();
}

void boot();
