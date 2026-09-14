import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react';
import { systemLogger } from '../services/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    systemLogger.logError(
      `React ErrorBoundary Caught Crash: ${error.message}`,
      {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
      'ReactErrorBoundary'
    );
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleOpenLogs = () => {
    systemLogger.openLogsFolder();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans select-none" dir="rtl">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-red-500/30 p-8 shadow-2xl shadow-red-950/40 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 mb-6 border border-red-500/30">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-black text-white mb-2">توقف مؤقت في النظام</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              حدث خطأ غير متوقع أثناء تشغيل هذه الواجهة. تم تسجيل تقرير الخطأ تلقائياً في سجلات النظام <code className="text-red-400 text-xs bg-slate-800 px-2 py-1 rounded">system-errors.log</code> لحفظ بياناتك.
            </p>

            {this.state.error && (
              <div className="mb-6 rounded-2xl bg-slate-950 border border-slate-800 p-4 text-start font-mono text-xs text-red-300 max-h-36 overflow-y-auto" dir="ltr">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-95 transition cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>إعادة تحميل التطبيق</span>
              </button>

              <button
                type="button"
                onClick={this.handleOpenLogs}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-6 py-3 font-bold text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 transition border border-slate-700 cursor-pointer"
              >
                <FolderOpen className="h-4 w-4" />
                <span>فتح مجلد السجلات (Logs)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
