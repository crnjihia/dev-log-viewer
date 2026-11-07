// path: src/store/keymapStore.ts

import { create } from 'zustand';

export type KeymapMode = 'vim' | 'standard';

export type KeyAction =
  | 'moveDown'
  | 'moveUp'
  | 'jumpTop'
  | 'jumpBottom'
  | 'pageDown'
  | 'pageUp'
  | 'openSearch'
  | 'openJsonFilter'
  | 'openPresets'
  | 'openCommandPalette'
  | 'toggleFollow'
  | 'toggleWordWrap'
  | 'toggleColumns'
  | 'copyLine';

export interface KeymapConfig {
  mode: KeymapMode;
  bindings: Record<KeyAction, string[]>;
}

const STORAGE_KEYMAP_KEY = 'dev_log_viewer_keymap_mode';

const VIM_BINDINGS: Record<KeyAction, string[]> = {
  moveDown: ['j', 'ArrowDown'],
  moveUp: ['k', 'ArrowUp'],
  jumpTop: ['g g', 'Home'],
  jumpBottom: ['G', 'End'],
  pageDown: ['Ctrl+d', 'PageDown'],
  pageUp: ['Ctrl+u', 'PageUp'],
  openSearch: ['/', 'Ctrl+f'],
  openJsonFilter: ['?', 'Ctrl+j'],
  openPresets: ['Ctrl+p'],
  openCommandPalette: ['Ctrl+k', 'Ctrl+Shift+P', 'F1'],
  toggleFollow: ['f', 'Shift+F'],
  toggleWordWrap: ['Alt+z'],
  toggleColumns: ['Ctrl+e'],
  copyLine: ['y y', 'Ctrl+c'],
};

const STANDARD_BINDINGS: Record<KeyAction, string[]> = {
  moveDown: ['ArrowDown'],
  moveUp: ['ArrowUp'],
  jumpTop: ['Home', 'Ctrl+Home'],
  jumpBottom: ['End', 'Ctrl+End'],
  pageDown: ['PageDown'],
  pageUp: ['PageUp'],
  openSearch: ['Ctrl+f'],
  openJsonFilter: ['Ctrl+j'],
  openPresets: ['Ctrl+p'],
  openCommandPalette: ['Ctrl+k', 'Ctrl+Shift+P', 'F1'],
  toggleFollow: ['Shift+F'],
  toggleWordWrap: ['Alt+z'],
  toggleColumns: ['Ctrl+e'],
  copyLine: ['Ctrl+c'],
};

interface KeymapState {
  mode: KeymapMode;
  setMode: (mode: KeymapMode) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  getBindings: (action: KeyAction) => string[];
  getPrimaryShortcut: (action: KeyAction) => string;
}

function loadInitialMode(): KeymapMode {
  if (typeof localStorage === 'undefined') return 'vim';
  const saved = localStorage.getItem(STORAGE_KEYMAP_KEY);
  if (saved === 'standard' || saved === 'vim') {
    return saved;
  }
  return 'vim';
}

export const useKeymapStore = create<KeymapState>((set, get) => ({
  mode: loadInitialMode(),
  isCommandPaletteOpen: false,
  setIsCommandPaletteOpen: (open: boolean) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

  setMode: (mode: KeymapMode) => {
    set({ mode });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYMAP_KEY, mode);
    }
  },

  getBindings: (action: KeyAction) => {
    const { mode } = get();
    const map = mode === 'vim' ? VIM_BINDINGS : STANDARD_BINDINGS;
    return map[action] ?? [];
  },

  getPrimaryShortcut: (action: KeyAction) => {
    const bindings = get().getBindings(action);
    return bindings[0] ?? '';
  },
}));
