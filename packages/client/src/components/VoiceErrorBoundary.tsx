import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface VoiceErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface VoiceErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class VoiceErrorBoundary extends Component<
  VoiceErrorBoundaryProps,
  VoiceErrorBoundaryState
> {
  constructor(props: VoiceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): VoiceErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (typeof window !== 'undefined' && window.location.search.includes('voicedebug=1')) {
      console.error('[VoiceErrorBoundary caught error]:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-600/40 text-amber-200 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="truncate max-w-[120px] sm:max-w-none">ভয়েসে সমস্যা</span>
          <button
            type="button"
            onClick={this.handleRetry}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold transition text-xs"
            title="পুনরায় চেষ্টা করুন"
          >
            <RefreshCw className="w-3 h-3" />
            <span>রিট্রাই</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
