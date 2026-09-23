import React from 'react';
import { Wifi, Cloud, CheckCircle2 } from 'lucide-react';

interface LivePulseBadgeProps {
  isCloudConnected: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
}

export function LivePulseBadge({ isCloudConnected, lastUpdated, onRefresh }: LivePulseBadgeProps) {
  const timeFormatted = lastUpdated
    ? lastUpdated.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <button
      onClick={onRefresh}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 shadow-xs border ${
        isCloudConnected
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      }`}
      title={isCloudConnected ? 'متصل بالسحابة وتحديث لحظي مستمر' : 'يعمل بالبيانات المحلية المتزامنة'}
    >
      <span className="relative flex h-2 w-2">
        {isCloudConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isCloudConnected ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        ></span>
      </span>

      <span className="flex items-center gap-1 text-[11px] font-black">
        {isCloudConnected ? (
          <>
            <Cloud className="w-3 h-3 text-emerald-400" />
            <span>مباشر</span>
          </>
        ) : (
          <>
            <Wifi className="w-3 h-3 text-amber-400" />
            <span>محلي</span>
          </>
        )}
      </span>

      {timeFormatted && (
        <span className="text-[10px] text-slate-400 hidden sm:inline-block font-mono">
          {timeFormatted}
        </span>
      )}
    </button>
  );
}
