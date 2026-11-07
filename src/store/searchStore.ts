// path: src/store/searchStore.ts

import { create } from 'zustand';
import { LineMeta, MatchRange } from '../types';
import { useLogStore } from './logStore';

export interface SearchState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;

  query: string;
  setQuery: (query: string) => void;

  isCaseSensitive: boolean;
  toggleCaseSensitive: () => void;

  isWholeWord: boolean;
  toggleWholeWord: () => void;

  isRegex: boolean;
  toggleRegex: () => void;

  matches: LineMeta[];
  currentMatchIdx: number;
  isSearching: boolean;

  runSearch: () => Promise<void>;
  nextMatch: () => void;
  prevMatch: () => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),

  query: '',
  setQuery: (query) => {
    set({ query });
    get().runSearch();
  },

  isCaseSensitive: false,
  toggleCaseSensitive: () => {
    set((s) => ({ isCaseSensitive: !s.isCaseSensitive }));
    get().runSearch();
  },

  isWholeWord: false,
  toggleWholeWord: () => {
    set((s) => ({ isWholeWord: !s.isWholeWord }));
    get().runSearch();
  },

  isRegex: false,
  toggleRegex: () => {
    set((s) => ({ isRegex: !s.isRegex }));
    get().runSearch();
  },

  matches: [],
  currentMatchIdx: -1,
  isSearching: false,

  runSearch: async () => {
    const { query, isCaseSensitive, isWholeWord, isRegex } = get();
    if (!query.trim()) {
      set({ matches: [], currentMatchIdx: -1, isSearching: false });
      return;
    }

    set({ isSearching: true });

    // Check if running under Tauri
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const activeFile = useLogStore.getState().activeFile;
        const results = await invoke<LineMeta[]>('search_log', {
          fileId: activeFile?.file_id ?? '',
          query,
          options: {
            case_sensitive: isCaseSensitive,
            whole_word: isWholeWord,
            is_regex: isRegex,
            max_results: 5000,
          },
        });

        set({
          matches: results,
          currentMatchIdx: results.length > 0 ? 0 : -1,
          isSearching: false,
        });

        if (results.length > 0) {
          useLogStore.getState().setJumpTarget(results[0].line_number);
        }
        return;
      } catch (e) {
        console.warn('Tauri search fallback to client scanner:', e);
      }
    }

    // Fast client-side scan across cached / sample lines
    const { totalLines, fetchWindow } = useLogStore.getState();
    const sampleWindow = await fetchWindow(0, Math.min(totalLines, 5000));

    let regex: RegExp;
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      const pattern = isRegex
        ? isWholeWord
          ? `\\b(?:${query})\\b`
          : query
        : isWholeWord
        ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
        : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      regex = new RegExp(pattern, flags);
    } catch {
      // Invalid regex syntax while typing
      set({ matches: [], currentMatchIdx: -1, isSearching: false });
      return;
    }

    const matchedLines: LineMeta[] = [];
    for (const line of sampleWindow) {
      regex.lastIndex = 0;
      const matchRanges: MatchRange[] = [];
      let m: RegExpExecArray | null;

      while ((m = regex.exec(line.text)) !== null) {
        matchRanges.push({
          start: m.index,
          end: m.index + m[0].length,
        });
        if (!regex.global) break;
      }

      if (matchRanges.length > 0) {
        matchedLines.push({
          ...line,
          matches: matchRanges,
        });
      }
    }

    set({
      matches: matchedLines,
      currentMatchIdx: matchedLines.length > 0 ? 0 : -1,
      isSearching: false,
    });

    if (matchedLines.length > 0) {
      useLogStore.getState().setJumpTarget(matchedLines[0].line_number);
    }
  },

  nextMatch: () => {
    const { matches, currentMatchIdx } = get();
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % matches.length;
    set({ currentMatchIdx: nextIdx });
    useLogStore.getState().setJumpTarget(matches[nextIdx].line_number);
  },

  prevMatch: () => {
    const { matches, currentMatchIdx } = get();
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + matches.length) % matches.length;
    set({ currentMatchIdx: prevIdx });
    useLogStore.getState().setJumpTarget(matches[prevIdx].line_number);
  },

  clearSearch: () => {
    set({
      query: '',
      matches: [],
      currentMatchIdx: -1,
      isSearching: false,
      isOpen: false,
    });
  },
}));
