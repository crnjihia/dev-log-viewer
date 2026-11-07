// path: src/components/StatusBar.tsx

import React from 'react';
import { Clock, ShieldCheck, FileText, Database, Activity, AlertCircle } from 'lucide-react';
import { useLogStore } from '../store/logStore';
import { translations } from '../i18n/locales';

export const StatusBar: React.FC = () => {
  const {
    locale,
    activeFile,
    totalLines,
    isIndexing,
    indexingPercent,
    selectedLine,
    isTailFollow,
    notification,
  } = useLogStore();

  const t = translations[locale];

  return (
    <footer className="h-7 px-3 bg-devlog-surface border-t border-devlog-border flex items-center justify-between text-[11px] text-slate-400 font-mono select-none flex-shrink-0">
      {/* Left: File Info & Indexing Status */}
      <div className="flex items-center space-x-3">
        {activeFile && (
          <div className="flex items-center space-x-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-200">
              {totalLines.toLocaleString()} {t.lines}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-1.5">
          {isIndexing ? (
            <span className="flex items-center space-x-1 text-amber-400 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>{t.indexing} ({indexingPercent.toFixed(1)}%)</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{t.indexingComplete}</span>
            </span>
          )}
        </div>

        {/* Live Tail Status Indicator */}
        <div className="flex items-center space-x-1 border-l border-devlog-border/80 pl-3">
          <Activity className={`w-3 h-3 ${isTailFollow ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          <span className={isTailFollow ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
            {isTailFollow ? t.followOn : t.followOff}
          </span>
        </div>

        {notification && (
          <div className="flex items-center space-x-1 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded text-amber-300 animate-in fade-in">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {selectedLine && !notification && (
          <div className="border-l border-devlog-border/80 pl-3 text-slate-300">
            {t.line} <span className="text-white font-semibold">{selectedLine.line_number}</span> (offset: {selectedLine.byte_offset} B)
          </div>
        )}
      </div>

      {/* Right: Encoding & Nairobi Timezone */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <Database className="w-3 h-3 text-slate-500" />
          <span>{activeFile?.detected_encoding ?? 'UTF-8'}</span>
        </div>

        <div className="flex items-center space-x-1 text-slate-400">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{t.timezone}</span>
        </div>

        <div className="flex items-center space-x-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Chris Njihia • Nairobi</span>
        </div>
      </div>
    </footer>
  );
};

