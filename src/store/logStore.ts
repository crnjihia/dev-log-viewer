// path: src/store/logStore.ts

import { create } from 'zustand';
import { LineMeta, LogFileMeta, LogLevel, Locale } from '../types';

interface LogState {
  locale: Locale;
  setLocale: (locale: Locale) => void;

  activeFile: LogFileMeta | null;
  setActiveFile: (file: LogFileMeta | null) => void;

  totalLines: number;
  setTotalLines: (total: number) => void;

  isIndexing: boolean;
  indexingPercent: number;
  setIndexingProgress: (percent: number, isDone: boolean) => void;

  isWordWrap: boolean;
  toggleWordWrap: () => void;

  selectedLine: LineMeta | null;
  setSelectedLine: (line: LineMeta | null) => void;

  isTailFollow: boolean;
  setIsTailFollow: (follow: boolean) => void;
  toggleTailFollow: () => void;

  notification: string | null;
  setNotification: (msg: string | null) => void;

  jumpTarget: number | null;
  setJumpTarget: (line: number | null) => void;

  linesCache: Map<number, LineMeta>;
  fetchWindow: (startLine: number, count: number) => Promise<LineMeta[]>;
  loadSampleFixture: () => void;
  appendSyntheticLines: (count?: number) => void;
  resetStream: () => void;
}

// Generate deterministic in-memory lines for instant zero-credential preview
function generateSyntheticLine(lineNum: number): LineMeta {
  const isError = lineNum % 17 === 0;
  const isWarn = lineNum % 7 === 0 && !isError;
  const level: LogLevel = isError ? 'error' : isWarn ? 'warn' : 'info';

  const timeSec = String(lineNum % 60).padStart(2, '0');
  const timeMin = String(Math.floor(lineNum / 60) % 60).padStart(2, '0');
  const timestamp = `2026-11-07T16:${timeMin}:${timeSec}.245+03:00`;

  let text: string;
  if (isError) {
    text = `{"timestamp":"${timestamp}","level":"error","service":"daraja-stk-push","trace_id":"trc-e83910${lineNum}","duration_ms":1842,"user_msisdn":"+254700000042","error":"Daraja STK timeout: Safaricom peer host connection reset"}`;
  } else if (isWarn) {
    text = `${timestamp} [WARN] ecitizen-revenue-gateway trace_id=trc-a92184${lineNum} duration_ms=890 user_msisdn=+254100000015 msg="Slow settlement batch processing: KES 45,000 threshold exceeded"`;
  } else {
    text = `{"timestamp":"${timestamp}","level":"info","service":"daraja-c2b-validator","trace_id":"trc-029184${lineNum}","duration_ms":48,"user_msisdn":"+254700000010","receipt":"SYN-KES-${100000 + (lineNum % 900000)}","amount_kes":${100 + (lineNum % 5000)},"message":"M-Pesa payment confirmation settled to merchant till"}`;
  }

  return {
    line_number: lineNum + 1,
    byte_offset: lineNum * 180,
    byte_length: text.length,
    level,
    text,
    matches: [],
    is_truncated: false,
  };
}

export const useLogStore = create<LogState>((set, get) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),

  activeFile: {
    file_id: 'sample-nairobi-dev.log',
    path: 'sample-nairobi-dev.log',
    file_size_bytes: 52_428_800, // 50 MB
    line_count_estimated: 100_000,
    is_indexed: true,
    detected_encoding: 'UTF-8',
  },
  setActiveFile: (file) => set({ activeFile: file }),

  totalLines: 100_000,
  setTotalLines: (totalLines) => set({ totalLines }),

  isIndexing: false,
  indexingPercent: 100.0,
  setIndexingProgress: (percent, isDone) =>
    set({ indexingPercent: percent, isIndexing: !isDone }),

  isWordWrap: false,
  toggleWordWrap: () => set((state) => ({ isWordWrap: !state.isWordWrap })),

  selectedLine: null,
  setSelectedLine: (line) => set({ selectedLine: line }),

  isTailFollow: false,
  setIsTailFollow: (follow) => set({ isTailFollow: follow }),
  toggleTailFollow: () => set((s) => ({ isTailFollow: !s.isTailFollow })),

  notification: null,
  setNotification: (msg) => {
    set({ notification: msg });
    if (msg) {
      setTimeout(() => {
        if (get().notification === msg) {
          set({ notification: null });
        }
      }, 4000);
    }
  },

  jumpTarget: null,
  setJumpTarget: (line) => set({ jumpTarget: line }),

  linesCache: new Map<number, LineMeta>(),

  fetchWindow: async (startLine: number, count: number): Promise<LineMeta[]> => {
    const { linesCache } = get();
    const result: LineMeta[] = [];
    const missingIndices: number[] = [];

    for (let i = 0; i < count; i++) {
      const lineIdx = startLine + i;
      const cached = linesCache.get(lineIdx);
      if (cached) {
        result.push(cached);
      } else {
        missingIndices.push(lineIdx);
      }
    }

    if (missingIndices.length > 0) {
      // Check if Tauri runtime is available
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      if (isTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const windowData = await invoke<{ lines: LineMeta[] }>('get_lines', {
            fileId: get().activeFile?.file_id ?? '',
            startLine,
            count,
            maxLineLen: 10_000,
          });

          const newCache = new Map(linesCache);
          for (const line of windowData.lines) {
            newCache.set(line.line_number - 1, line);
          }
          set({ linesCache: newCache });
          return windowData.lines;
        } catch (e) {
          console.warn('Tauri invoke failed, using fast synthetic pipeline:', e);
        }
      }

      // Fast fallback synthetic line generation
      const newCache = new Map(linesCache);
      for (const idx of missingIndices) {
        const line = generateSyntheticLine(idx);
        newCache.set(idx, line);
        result.push(line);
      }
      set({ linesCache: newCache });
    }

    result.sort((a, b) => a.line_number - b.line_number);
    return result;
  },

  loadSampleFixture: () => {
    set({
      activeFile: {
        file_id: 'nairobi-fintech-traffic.log',
        path: 'nairobi-fintech-traffic.log',
        file_size_bytes: 104_857_600, // 100 MB
        line_count_estimated: 250_000,
        is_indexed: true,
        detected_encoding: 'UTF-8',
      },
      totalLines: 250_000,
      linesCache: new Map(),
      selectedLine: null,
    });
  },

  appendSyntheticLines: (count = 1) => {
    const { totalLines, linesCache, isTailFollow } = get();
    const newTotal = totalLines + count;
    const newCache = new Map(linesCache);

    for (let i = 0; i < count; i++) {
      const idx = totalLines + i;
      const newLine = generateSyntheticLine(idx);
      newCache.set(idx, newLine);
    }

    set({ totalLines: newTotal, linesCache: newCache });

    if (isTailFollow) {
      set({ jumpTarget: newTotal });
    }
  },

  resetStream: () => {
    set({ totalLines: 0, linesCache: new Map(), jumpTarget: null });
  },
}));

