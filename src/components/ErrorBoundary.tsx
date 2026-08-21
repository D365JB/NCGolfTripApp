import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Catches render/runtime errors anywhere in the tree so a single component fault
// shows a friendly recovery card instead of a blank white screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center bg-sand-50 px-6 text-center">
          <div className="max-w-sm">
            <p className="text-lg font-bold text-ink">Something went wrong</p>
            <p className="mt-1 text-sm text-ink/60">
              The app hit an unexpected error. Your data is safe on this device.
            </p>
            <button
              onClick={() => location.reload()}
              className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
