// path: src/components/LogViewer.tsx

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogStore } from '../store/logStore';
import { useSearchStore } from '../store/searchStore';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { LogLineRow } from './LogLineRow';
import { VirtualScrollbar } from './VirtualScrollbar';
import { SearchToolbar } from './SearchToolbar';
import { StructuredQueryBar } from './StructuredQueryBar';
import { SideDetailPanel } from './SideDetailPanel';
import { ColumnExtractionView } from './ColumnExtractionView';
import { Minimap } from './Minimap';
import { LineMeta } from '../types';

const ROW_HEIGHT = 24;

export const LogViewer: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null);
  const {
    totalLines,
    isWordWrap,
    selectedLine,
    setSelectedLine,
    fetchWindow,
    jumpTarget,
    setJumpTarget,
  } = useLogStore();

  const { matches: searchMatches } = useSearchStore();
  const {
    isColumnView,
    filterOnlyMatching,
    matchingLines,
  } = useJsonQueryStore();

  const [linesMap, setLinesMap] = useState<Map<number, LineMeta>>(new Map());
  const [currentTopLine, setCurrentTopLine] = useState(0);

  // Quick lookup map of search matches by line number
  const searchMatchMap = useMemo(() => {
    const map = new Map<number, LineMeta>();
    for (const m of searchMatches) {
      map.set(m.line_number, m);
    }
    return map;
  }, [searchMatches]);

  // When filterOnlyMatching is enabled, use filtered count
  const effectiveLineCount = filterOnlyMatching ? matchingLines.length : totalLines;

  const rowVirtualizer = useVirtualizer({
    count: effectiveLineCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 25,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (filterOnlyMatching) return;
    if (virtualItems.length === 0) return;

    const start = virtualItems[0].index;
    const count = virtualItems.length;
    setCurrentTopLine(start);

    let isMounted = true;
    fetchWindow(start, count).then((fetchedLines) => {
      if (!isMounted) return;
      setLinesMap((prev) => {
        const next = new Map(prev);
        for (const line of fetchedLines) {
          next.set(line.line_number - 1, line);
        }
        return next;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [virtualItems, fetchWindow, filterOnlyMatching]);

  useEffect(() => {
    if (jumpTarget !== null) {
      const targetIndex = Math.max(0, Math.min(jumpTarget - 1, effectiveLineCount - 1));
      rowVirtualizer.scrollToIndex(targetIndex, { align: 'center' });
      setJumpTarget(null);
    }
  }, [jumpTarget, effectiveLineCount, rowVirtualizer, setJumpTarget]);

  const handleScrollToLine = useCallback(
    (targetLine: number) => {
      rowVirtualizer.scrollToIndex(targetLine, { align: 'start' });
    },
    [rowVirtualizer]
  );

  // Array of lines for column extraction view
  const currentDisplayedLines = useMemo(() => {
    if (filterOnlyMatching) return matchingLines;
    return Array.from(linesMap.values()).sort((a, b) => a.line_number - b.line_number);
  }, [filterOnlyMatching, matchingLines, linesMap]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-devlog-bg">
      {/* Floating Search Toolbar & Structured Query Bar */}
      <SearchToolbar />
      <StructuredQueryBar />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Log Area: Column Extraction View or Virtualized Row View */}
        {isColumnView ? (
          <ColumnExtractionView lines={currentDisplayedLines} />
        ) : (
          <div
            ref={parentRef}
            className="flex-1 overflow-auto will-change-transform"
            tabIndex={0}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const line = filterOnlyMatching
                  ? matchingLines[virtualRow.index]
                  : linesMap.get(virtualRow.index);

                // Overlay search match if present on this line
                const activeLine = line
                  ? searchMatchMap.get(line.line_number) ?? line
                  : undefined;

                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {activeLine ? (
                      <LogLineRow
                        line={activeLine}
                        isSelected={selectedLine?.line_number === activeLine.line_number}
                        isWordWrap={isWordWrap}
                        onSelect={setSelectedLine}
                      />
                    ) : (
                      <div className="h-6 flex items-center px-4 font-mono text-xs text-slate-600 bg-devlog-bg select-none">
                        <span className="w-16 text-right pr-3">{virtualRow.index + 1}</span>
                        <span className="animate-pulse">Loading line {virtualRow.index + 1}...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Hits Minimap (only in raw mode) */}
        {!isColumnView && <Minimap />}

        {/* Direct line-mapped custom scrollbar (only in raw mode) */}
        {!isColumnView && (
          <VirtualScrollbar
            totalLines={effectiveLineCount}
            currentLine={currentTopLine}
            visibleCount={virtualItems.length || 30}
            onScrollToLine={handleScrollToLine}
          />
        )}

        {/* Side Detail Inspector Panel */}
        <SideDetailPanel />
      </div>
    </div>
  );
};
