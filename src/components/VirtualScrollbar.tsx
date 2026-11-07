// path: src/components/VirtualScrollbar.tsx

import React, { useRef, useCallback, useEffect } from 'react';

interface VirtualScrollbarProps {
  totalLines: number;
  currentLine: number;
  visibleCount: number;
  onScrollToLine: (targetLine: number) => void;
}

export const VirtualScrollbar: React.FC<VirtualScrollbarProps> = ({
  totalLines,
  currentLine,
  visibleCount,
  onScrollToLine,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartLineRef = useRef(0);

  const effectiveTotal = Math.max(totalLines, 1);
  const ratio = Math.min(Math.max(currentLine / effectiveTotal, 0), 1);

  // Compute thumb height: minimum 24px, maximum 80% of track
  const thumbHeightPercent = Math.min(
    Math.max((visibleCount / effectiveTotal) * 100, 4),
    80
  );
  const thumbTopPercent = ratio * (100 - thumbHeightPercent);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickRatio = Math.min(Math.max(clickY / rect.height, 0), 1);
    const targetLine = Math.round(clickRatio * effectiveTotal);
    onScrollToLine(targetLine);
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartLineRef.current = currentLine;
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaY = e.clientY - dragStartYRef.current;
      const deltaRatio = deltaY / rect.height;
      const deltaLines = deltaRatio * effectiveTotal;
      const targetLine = Math.round(
        Math.min(Math.max(dragStartLineRef.current + deltaLines, 0), effectiveTotal - visibleCount)
      );
      onScrollToLine(targetLine);
    },
    [effectiveTotal, onScrollToLine, visibleCount]
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.body.style.userSelect = '';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      className="w-3 bg-devlog-surface/80 border-l border-devlog-border relative cursor-pointer select-none flex-shrink-0"
      title={`Scrub lines: ${currentLine.toLocaleString()} of ${totalLines.toLocaleString()}`}
    >
      {/* Scrollbar Thumb */}
      <div
        onMouseDown={handleThumbMouseDown}
        style={{
          top: `${thumbTopPercent}%`,
          height: `${thumbHeightPercent}%`,
        }}
        className="w-full bg-slate-600 hover:bg-devlog-accent/80 active:bg-devlog-accent rounded-sm absolute transition-colors cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};

