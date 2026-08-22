import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import { seedIfEmpty } from './db/seed';
import { recoverFromLocalIfEmpty, startAutoSnapshot } from './services/resilience';
import { startCloudSync, seedCloudFromLocal } from './services/cloudSync';
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

  // Seed starter data if the DB is empty (fast, local). The app is local-first,
  // so we always have something to render immediately.
  await seedIfEmpty().catch(() => {});

  // Expose a one-time uploader so an admin device can seed the cloud from its
  // existing local data (call window.__seedCloud() from the console once).
  (window as unknown as { __seedCloud?: typeof seedCloudFromLocal }).__seedCloud = seedCloudFromLocal;

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

  // Connect to the shared cloud backend in the background (non-blocking). If a
  // reachable /api backend exists, it hydrates + keeps Dexie in sync and the UI
  // updates reactively via useLiveQuery; otherwise the app stays local-first.
  void startCloudSync();
}

void boot();
