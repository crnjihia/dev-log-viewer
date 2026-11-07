// path: src/components/LogLineRow.tsx

import React, { memo } from 'react';
import { LineMeta, LogLevel, MatchRange } from '../types';

interface LogLineRowProps {
  line: LineMeta;
  isSelected: boolean;
  isWordWrap: boolean;
  onSelect: (line: LineMeta) => void;
}

const LEVEL_COLORS: Record<LogLevel, { text: string; bg: string; border: string }> = {
  error: { text: 'text-red-400', bg: 'bg-red-950/30', border: 'border-l-red-500' },
  warn: { text: 'text-amber-400', bg: 'bg-amber-950/20', border: 'border-l-amber-500' },
  info: { text: 'text-blue-400', bg: 'bg-blue-950/10', border: 'border-l-blue-500' },
  debug: { text: 'text-purple-400', bg: 'bg-purple-950/10', border: 'border-l-purple-500' },
  trace: { text: 'text-slate-400', bg: 'bg-transparent', border: 'border-l-slate-600' },
  unknown: { text: 'text-slate-400', bg: 'bg-transparent', border: 'border-l-transparent' },
};

function renderHighlightedWithMatches(rawText: string, matches: MatchRange[]): React.ReactNode {
  if (matches.length === 0) {
    return renderHighlightedText(rawText);
  }

  // Sort matches by start position
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (m.start > lastIndex) {
      elements.push(
        <span key={`txt-${lastIndex}`}>
          {renderHighlightedText(rawText.substring(lastIndex, m.start))}
        </span>
      );
    }

    elements.push(
      <mark
        key={`match-${i}`}
        className="bg-amber-400 text-black font-bold px-0.5 rounded-sm shadow-sm"
      >
        {rawText.substring(m.start, m.end)}
      </mark>
    );

    lastIndex = m.end;
  }

  if (lastIndex < rawText.length) {
    elements.push(
      <span key={`txt-${lastIndex}`}>
        {renderHighlightedText(rawText.substring(lastIndex))}
      </span>
    );
  }

  return elements;
}

function renderHighlightedText(rawText: string): React.ReactNode {
  const tokenRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\+\d{2}:\d{2}|Z)?)|(\+254\d{9})|(SYN-KES-\d{6})|(KES\s*[\d,]+(?:\.\d{2})?)|("(?:\\"|[^"])*"(?=\s*:))|("(?:\\"|[^"])*")|(\b\d+\b)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(rawText.substring(lastIndex, match.index));
    }

    const [fullMatch, timestamp, msisdn, receipt, kesAmount, jsonKey, stringVal, numberVal] = match;

    if (timestamp) {
      nodes.push(
        <span key={match.index} className="text-slate-400">
          {fullMatch}
        </span>
      );
    } else if (msisdn) {
      nodes.push(
        <span key={match.index} className="text-emerald-400 font-semibold underline decoration-emerald-600/40">
          {fullMatch}
        </span>
      );
    } else if (receipt) {
      nodes.push(
        <span key={match.index} className="text-amber-300 font-mono font-bold bg-amber-950/40 px-1 rounded">
          {fullMatch}
        </span>
      );
    } else if (kesAmount) {
      nodes.push(
        <span key={match.index} className="text-emerald-300 font-bold">
          {fullMatch}
        </span>
      );
    } else if (jsonKey) {
      nodes.push(
        <span key={match.index} className="text-cyan-300 font-medium">
          {fullMatch}
        </span>
      );
    } else if (stringVal) {
      nodes.push(
        <span key={match.index} className="text-emerald-300/90">
          {fullMatch}
        </span>
      );
    } else if (numberVal) {
      nodes.push(
        <span key={match.index} className="text-amber-400">
          {fullMatch}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    nodes.push(rawText.substring(lastIndex));
  }

  return nodes;
}

export const LogLineRow: React.FC<LogLineRowProps> = memo(({
  line,
  isSelected,
  isWordWrap,
  onSelect,
}) => {
  const levelStyle = LEVEL_COLORS[line.level];

  return (
    <div
      onClick={() => onSelect(line)}
      className={`flex items-stretch font-mono text-xs select-text cursor-pointer transition-colors border-l-2 ${
        isSelected
          ? 'bg-blue-900/30 border-l-blue-400 text-white'
          : `${levelStyle.bg} ${levelStyle.border} hover:bg-slate-800/50 text-slate-300`
      }`}
      style={{ minHeight: '24px' }}
    >
      <div className="w-16 flex-shrink-0 text-right pr-3 pl-2 select-none text-slate-400 font-mono border-r border-devlog-border/60 bg-devlog-surface/30 leading-6">
        {line.line_number}
      </div>

      <div className="w-14 flex-shrink-0 flex items-center justify-center select-none leading-6 px-1">
        <span className={`text-[10px] uppercase font-bold tracking-wider ${levelStyle.text}`}>
          {line.level}
        </span>
      </div>

      <div
        className={`flex-1 pl-2 pr-4 leading-6 ${
          isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
        }`}
      >
        {renderHighlightedWithMatches(line.text, line.matches)}

        {line.is_truncated && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-700/60 text-[10px] font-bold">
            TRUNCATED
          </span>
        )}
      </div>
    </div>
  );
});

LogLineRow.displayName = 'LogLineRow';
