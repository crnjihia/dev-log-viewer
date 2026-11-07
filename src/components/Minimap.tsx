// path: src/components/Minimap.tsx

import React from 'react';
import { useSearchStore } from '../store/searchStore';
import { useLogStore } from '../store/logStore';

export const Minimap: React.FC = () => {
  const { matches, currentMatchIdx } = useSearchStore();
  const { totalLines, setJumpTarget } = useLogStore();

  if (matches.length === 0 || totalLines <= 0) return null;

  return (
    <div className="w-2.5 bg-devlog-surface/60 border-l border-devlog-border/60 relative select-none flex-shrink-0">
      {matches.map((m, idx) => {
        const topPercent = (m.line_number / totalLines) * 100;
        const isCurrent = idx === currentMatchIdx;

        return (
          <div
            key={m.line_number}
            onClick={() => setJumpTarget(m.line_number)}
            style={{ top: `${topPercent}%` }}
            title={`Match on line ${m.line_number}`}
            className={`absolute left-0 right-0 h-1 cursor-pointer transition-colors ${
              isCurrent ? 'bg-amber-400 z-10 scale-y-150' : 'bg-amber-500/70 hover:bg-amber-300'
            }`}
          />
        );
      })}
    </div>
  );
};

