import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-slate-50">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">页面出错了</h2>
          <p className="text-slate-600 text-center max-w-md mb-6">
            {this.state.error?.message || '发生了意外错误，请刷新页面重试'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            <RefreshCw size={18} />
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
