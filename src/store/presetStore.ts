// path: src/store/presetStore.ts

import { create } from 'zustand';
import { FilterPreset } from '../types';
import { useSearchStore } from './searchStore';
import { useJsonQueryStore } from './jsonQueryStore';

const STORAGE_KEY = 'dev_log_viewer_presets_v1';

export const BUILTIN_PRESETS: FilterPreset[] = [
  {
    id: 'preset-daraja-errors',
    name: 'Daraja STK Failures',
    description: 'Safaricom Daraja STK Push errors and gateway timeouts',
    queryType: 'json_query',
    query: 'level:error AND service:"daraja-stk-push"',
    isBuiltIn: true,
    createdAt: '2026-11-07T00:00:00Z',
  },
  {
    id: 'preset-mpesa-high-value',
    name: 'M-Pesa Settlements >= KES 10,000',
    description: 'High-value customer payments settled to merchant till',
    queryType: 'json_query',
    query: 'amount_kes>=10000',
    isBuiltIn: true,
    createdAt: '2026-11-07T00:00:00Z',
  },
  {
    id: 'preset-at-sms-failures',
    name: "Africa's Talking SMS Failures",
    description: 'Undelivered notifications or SMS gateway timeouts',
    queryType: 'json_query',
    query: 'service:"africas_talking" AND status:"failed"',
    isBuiltIn: true,
    createdAt: '2026-11-07T00:00:00Z',
  },
  {
    id: 'preset-slow-latency',
    name: 'Slow Latency (>1000ms)',
    description: 'Requests with execution duration exceeding 1 second',
    queryType: 'json_query',
    query: 'duration_ms>1000',
    isBuiltIn: true,
    createdAt: '2026-11-07T00:00:00Z',
  },
  {
    id: 'preset-stk-result-code-nonzero',
    name: 'Failed STK Push ResultCodes',
    description: 'Daraja STK callbacks with non-zero result code (e.g. 1032 user cancelled)',
    queryType: 'json_query',
    query: 'Body.stkCallback.ResultCode!=0',
    isBuiltIn: true,
    createdAt: '2026-11-07T00:00:00Z',
  },
  {
    id: 'preset-kenyan-phone-regex',
    name: 'Kenyan Mobile MSISDNs (+254)',
    description: 'Regex pattern matching Safaricom / Airtel / Telkom numbers',
    queryType: 'regex',
    query: String.raw`\+254[17]\d{8}`,
    options: {
      isRegex: true,
      isCaseSensitive: false,
      isWholeWord: false,
    },
    isBuiltIn: true,
    createdAt: '2026-11-07T00:00:00Z',
  },
];

interface PresetState {
  isPaletteOpen: boolean;
  setIsPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;

  presets: FilterPreset[];
  loadPresets: () => void;
  savePreset: (
    name: string,
    description: string,
    queryType: 'regex' | 'json_query',
    query: string,
    options?: FilterPreset['options']
  ) => void;
  deletePreset: (id: string) => void;
  applyPreset: (preset: FilterPreset) => void;
}

function loadPersistedPresets(): FilterPreset[] {
  if (typeof localStorage === 'undefined') return BUILTIN_PRESETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BUILTIN_PRESETS;
    const userPresets = JSON.parse(raw) as FilterPreset[];
    return [...BUILTIN_PRESETS, ...userPresets];
  } catch {
    return BUILTIN_PRESETS;
  }
}

export const usePresetStore = create<PresetState>((set, get) => ({
  isPaletteOpen: false,
  setIsPaletteOpen: (open) => set({ isPaletteOpen: open }),
  togglePalette: () => set((s) => ({ isPaletteOpen: !s.isPaletteOpen })),

  presets: loadPersistedPresets(),

  loadPresets: () => {
    set({ presets: loadPersistedPresets() });
  },

  savePreset: (name, description, queryType, query, options) => {
    const newPreset: FilterPreset = {
      id: `user-preset-${Date.now()}`,
      name,
      description,
      queryType,
      query,
      options,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };

    const current = get().presets;
    const updated = [...current, newPreset];
    set({ presets: updated });

    if (typeof localStorage !== 'undefined') {
      const userOnly = updated.filter((p) => !p.isBuiltIn);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
    }
  },

  deletePreset: (id: string) => {
    const current = get().presets;
    const updated = current.filter((p) => p.id !== id || p.isBuiltIn);
    set({ presets: updated });

    if (typeof localStorage !== 'undefined') {
      const userOnly = updated.filter((p) => !p.isBuiltIn);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
    }
  },

  applyPreset: (preset: FilterPreset) => {
    if (preset.queryType === 'regex') {
      const searchStore = useSearchStore.getState();
      searchStore.setIsOpen(true);
      if (preset.options?.isRegex !== undefined && searchStore.isRegex !== preset.options.isRegex) {
        searchStore.toggleRegex();
      }
      if (
        preset.options?.isCaseSensitive !== undefined &&
        searchStore.isCaseSensitive !== preset.options.isCaseSensitive
      ) {
        searchStore.toggleCaseSensitive();
      }
      if (
        preset.options?.isWholeWord !== undefined &&
        searchStore.isWholeWord !== preset.options.isWholeWord
      ) {
        searchStore.toggleWholeWord();
      }
      searchStore.setQuery(preset.query);
    } else {
      const jsonStore = useJsonQueryStore.getState();
      jsonStore.setIsOpen(true);
      jsonStore.setQuery(preset.query);
    }

    set({ isPaletteOpen: false });
  },
}));
