// path: src/store/jsonQueryStore.ts

import { create } from 'zustand';
import {
  compileQuery,
  DiscoveredField,
  evaluatePredicate,
  Predicate,
  QueryParseError,
  sampleJsonFields,
} from '../utils/jsonQuery';
import { LineMeta } from '../types';
import { useLogStore } from './logStore';

interface JsonQueryState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;

  query: string;
  setQuery: (query: string) => void;
  syntaxError: QueryParseError | null;
  predicate: Predicate | null;

  discoveredFields: DiscoveredField[];
  sampleFieldsFromLines: (lines: string[]) => void;

  selectedColumns: string[];
  toggleColumn: (col: string) => void;
  isColumnView: boolean;
  toggleColumnView: () => void;

  isSideInspectorOpen: boolean;
  setIsSideInspectorOpen: (open: boolean) => void;
  toggleSideInspector: () => void;

  matchingLines: LineMeta[];
  isFiltering: boolean;
  filterOnlyMatching: boolean;
  toggleFilterOnlyMatching: () => void;

  appendQueryClause: (field: string, op: string, value: string | number | boolean) => void;
  clearQuery: () => void;
}

export const useJsonQueryStore = create<JsonQueryState>((set, get) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

  query: '',
  syntaxError: null,
  predicate: null,

  setQuery: (query: string) => {
    if (!query.trim()) {
      set({
        query,
        syntaxError: null,
        predicate: null,
        matchingLines: [],
        isFiltering: false,
      });
      return;
    }

    const { predicate, error } = compileQuery(query);
    if (error) {
      set({ query, syntaxError: error, predicate: null });
      return;
    }

    set({ query, syntaxError: null, predicate: predicate ?? null, isFiltering: true });

    // Client-side filtering across available cached lines
    const { totalLines, fetchWindow } = useLogStore.getState();
    fetchWindow(0, Math.min(totalLines, 5000)).then((lines) => {
      const matches: LineMeta[] = [];
      for (const line of lines) {
        const trimmed = line.text.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (predicate && evaluatePredicate(predicate, parsed)) {
              matches.push(line);
            }
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
      set({ matchingLines: matches, isFiltering: false });
    });
  },

  discoveredFields: [],
  sampleFieldsFromLines: (lines: string[]) => {
    const fields = sampleJsonFields(lines);
    set({ discoveredFields: fields });

    // Auto-select initial common columns if none chosen
    if (get().selectedColumns.length === 0) {
      const preferred = ['timestamp', 'level', 'service', 'duration_ms', 'amount_kes', 'receipt'];
      const initial = fields
        .filter((f) => preferred.includes(f.path))
        .map((f) => f.path);
      if (initial.length > 0) {
        set({ selectedColumns: initial });
      }
    }
  },

  selectedColumns: ['timestamp', 'level', 'service', 'duration_ms'],
  toggleColumn: (col: string) => {
    const current = get().selectedColumns;
    if (current.includes(col)) {
      set({ selectedColumns: current.filter((c) => c !== col) });
    } else {
      set({ selectedColumns: [...current, col] });
    }
  },

  isColumnView: false,
  toggleColumnView: () => set((s) => ({ isColumnView: !s.isColumnView })),

  isSideInspectorOpen: false,
  setIsSideInspectorOpen: (open) => set({ isSideInspectorOpen: open }),
  toggleSideInspector: () => set((s) => ({ isSideInspectorOpen: !s.isSideInspectorOpen })),

  matchingLines: [],
  isFiltering: false,
  filterOnlyMatching: false,
  toggleFilterOnlyMatching: () => set((s) => ({ filterOnlyMatching: !s.filterOnlyMatching })),

  appendQueryClause: (field: string, op: string, value: string | number | boolean) => {
    const current = get().query.trim();
    let valStr: string;
    if (typeof value === 'string') {
      valStr = value.includes(' ') || value.includes(':') ? `"${value}"` : value;
    } else {
      valStr = String(value);
    }

    const clause = `${field}${op}${valStr}`;
    const newQuery = current ? `${current} AND ${clause}` : clause;
    get().setQuery(newQuery);
    set({ isOpen: true });
  },

  clearQuery: () => {
    set({
      query: '',
      syntaxError: null,
      predicate: null,
      matchingLines: [],
      isFiltering: false,
      filterOnlyMatching: false,
    });
  },
}));

