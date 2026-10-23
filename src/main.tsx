import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class StartupErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Always log full error details to console so debugging is uninhibited
    console.error('CineMax Startup / Runtime Error caught by StartupErrorBoundary:', error, errorInfo);
  }

  handleCopy = () => {
    const text = [
      `CineMax Error: ${this.state.error?.message || 'Unknown error'}`,
      `Location: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Stack:\n${this.state.error?.stack || ''}`,
      `Component Stack:\n${this.state.errorInfo?.componentStack || ''}`,
    ].join('\n\n');

    navigator.clipboard?.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {
      // Fallback
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleResetCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage clear failure
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected runtime error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';
      const errorStack = this.state.error?.stack || '';

      return (
        <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-4 sm:p-6 select-text">
          <div className="max-w-xl w-full bg-[#12151e] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 text-xl font-bold">
                !
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">CineMax Startup Notice</h1>
                <p className="text-sm text-slate-400 mt-1">
                  A client-side initialization or rendering error prevented this view from mounting properly.
                </p>
              </div>
            </div>

            <div className="bg-[#090a0f] border border-slate-800/80 rounded-xl p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Diagnostic Details
              </div>
              <p className="text-sm text-red-400 font-mono break-words">
                {errorMessage}
              </p>
              {(errorStack || componentStack) && (
                <details className="pt-2 text-xs text-slate-400 border-t border-slate-800">
                  <summary className="cursor-pointer hover:text-slate-200 py-1 font-medium select-none">
                    View technical call stack
                  </summary>
                  <pre className="mt-2 p-3 bg-black/60 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap max-h-48">
                    {errorStack}
                    {componentStack ? `\nComponent trace:\n${componentStack}` : ''}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer shadow-md"
              >
                Reload CineMax
              </button>
              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition-colors cursor-pointer"
              >
                Clear Local Cache & Reload
              </button>
              <button
                type="button"
                onClick={this.handleCopy}
                className="px-3 py-2.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors ml-auto cursor-pointer"
              >
                {this.state.copied ? '✓ Copied Details' : 'Copy Error Details'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <StartupErrorBoundary>
        <App />
      </StartupErrorBoundary>
    </React.StrictMode>
  );
}
