// path: src/store/themeStore.ts

import { create } from 'zustand';

export type ThemeId = 'dark' | 'light' | 'high-contrast' | 'kenyan-dusk' | 'custom';

export interface ThemeColors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  error: string;
  warn: string;
  info: string;
  success: string;
  debug: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  isBuiltIn: boolean;
  colors: ThemeColors;
}

const STORAGE_THEME_KEY = 'dev_log_viewer_theme_id';
const STORAGE_CUSTOM_THEME_KEY = 'dev_log_viewer_custom_theme_json';

export const BUILTIN_THEMES: Record<ThemeId, ThemeDefinition> = {
  dark: {
    id: 'dark',
    name: 'Obsidian Dark',
    description: 'Sleek dark theme optimized for long engineering sessions',
    isBuiltIn: true,
    colors: {
      bg: '#0d1117',
      surface: '#161b22',
      border: '#30363d',
      text: '#e6edf3',
      textMuted: '#8b949e',
      accent: '#38bdf8',
      error: '#f85149',
      warn: '#d29922',
      info: '#58a6ff',
      success: '#3fb950',
      debug: '#8b949e',
    },
  },
  light: {
    id: 'light',
    name: 'Daylight Clean',
    description: 'Crisp, high-readability daylight theme',
    isBuiltIn: true,
    colors: {
      bg: '#f8fafc',
      surface: '#ffffff',
      border: '#cbd5e1',
      text: '#0f172a',
      textMuted: '#64748b',
      accent: '#0284c7',
      error: '#dc2626',
      warn: '#d97706',
      info: '#2563eb',
      success: '#16a34a',
      debug: '#64748b',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast (WCAG AAA)',
    description: 'Maximum contrast black and neon colors for low-vision accessibility',
    isBuiltIn: true,
    colors: {
      bg: '#000000',
      surface: '#000000',
      border: '#ffffff',
      text: '#ffffff',
      textMuted: '#e2e8f0',
      accent: '#ffff00',
      error: '#ff3333',
      warn: '#ffcc00',
      info: '#33ccff',
      success: '#00ff66',
      debug: '#ffffff',
    },
  },
  'kenyan-dusk': {
    id: 'kenyan-dusk',
    name: 'Kenyan Dusk',
    description: 'Warm acacia and sunset amber palette honoring Nairobi horizons',
    isBuiltIn: true,
    colors: {
      bg: '#140d0a',
      surface: '#1f1410',
      border: '#42251a',
      text: '#fde8e0',
      textMuted: '#ab7f70',
      accent: '#f97316',
      error: '#ef4444',
      warn: '#f59e0b',
      info: '#fb923c',
      success: '#22c55e',
      debug: '#a88277',
    },
  },
  custom: {
    id: 'custom',
    name: 'User Custom JSON',
    description: 'Custom imported JSON palette',
    isBuiltIn: false,
    colors: {
      bg: '#121212',
      surface: '#1e1e1e',
      border: '#2e2e2e',
      text: '#f5f5f5',
      textMuted: '#9e9e9e',
      accent: '#bb86fc',
      error: '#cf6679',
      warn: '#ffb74d',
      info: '#64b5f6',
      success: '#81c784',
      debug: '#9e9e9e',
    },
  },
};

interface ThemeState {
  currentTheme: ThemeId;
  customTheme: ThemeDefinition | null;
  isThemeModalOpen: boolean;
  setIsThemeModalOpen: (open: boolean) => void;
  toggleThemeModal: () => void;
  setTheme: (themeId: ThemeId) => void;
  applyCustomThemeJson: (jsonStr: string) => { success: boolean; error?: string };
}

function applyThemeVariables(colors: ThemeColors, themeId: ThemeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.setAttribute('data-theme', themeId);
  root.style.setProperty('--color-bg', colors.bg);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-border', colors.border);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-muted', colors.textMuted);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-error', colors.error);
  root.style.setProperty('--color-warn', colors.warn);
  root.style.setProperty('--color-info', colors.info);
  root.style.setProperty('--color-success', colors.success);
  root.style.setProperty('--color-debug', colors.debug);
}

function loadInitialThemeId(): ThemeId {
  if (typeof localStorage === 'undefined') return 'dark';
  const saved = localStorage.getItem(STORAGE_THEME_KEY);
  if (saved && (saved in BUILTIN_THEMES || saved === 'custom')) {
    return saved as ThemeId;
  }
  return 'dark';
}

function loadInitialCustomTheme(): ThemeDefinition | null {
  if (typeof localStorage === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_CUSTOM_THEME_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as ThemeDefinition;
    } catch {
      return null;
    }
  }
  return null;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialThemeId = loadInitialThemeId();
  const initialCustom = loadInitialCustomTheme();

  // Apply initial theme to DOM
  const initialColors =
    initialThemeId === 'custom' && initialCustom
      ? initialCustom.colors
      : BUILTIN_THEMES[initialThemeId]?.colors ?? BUILTIN_THEMES.dark.colors;
  applyThemeVariables(initialColors, initialThemeId);

  return {
    currentTheme: initialThemeId,
    customTheme: initialCustom,
    isThemeModalOpen: false,
    setIsThemeModalOpen: (open) => set({ isThemeModalOpen: open }),
    toggleThemeModal: () => set((s) => ({ isThemeModalOpen: !s.isThemeModalOpen })),

    setTheme: (themeId: ThemeId) => {
      const { customTheme } = get();
      const themeDef =
        themeId === 'custom' && customTheme
          ? customTheme
          : BUILTIN_THEMES[themeId] ?? BUILTIN_THEMES.dark;

      applyThemeVariables(themeDef.colors, themeId);
      set({ currentTheme: themeId });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_THEME_KEY, themeId);
      }
    },

    applyCustomThemeJson: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as Partial<ThemeDefinition>;
        if (!parsed.colors || typeof parsed.colors !== 'object') {
          return { success: false, error: "Theme JSON must contain a 'colors' object" };
        }

        const requiredKeys: (keyof ThemeColors)[] = [
          'bg',
          'surface',
          'border',
          'text',
          'accent',
          'error',
          'warn',
          'info',
        ];

        for (const k of requiredKeys) {
          if (!parsed.colors[k] || typeof parsed.colors[k] !== 'string') {
            return {
              success: false,
              error: `Missing required color property: colors.${k}`,
            };
          }
        }

        const completeColors: ThemeColors = {
          bg: parsed.colors.bg!,
          surface: parsed.colors.surface!,
          border: parsed.colors.border!,
          text: parsed.colors.text!,
          textMuted: parsed.colors.textMuted || '#888888',
          accent: parsed.colors.accent!,
          error: parsed.colors.error!,
          warn: parsed.colors.warn!,
          info: parsed.colors.info!,
          success: parsed.colors.success || '#3fb950',
          debug: parsed.colors.debug || '#8b949e',
        };

        const customDef: ThemeDefinition = {
          id: 'custom',
          name: parsed.name || 'User Custom Theme',
          description: parsed.description || 'Imported via JSON',
          isBuiltIn: false,
          colors: completeColors,
        };

        set({ customTheme: customDef });
        get().setTheme('custom');

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_CUSTOM_THEME_KEY, JSON.stringify(customDef));
        }

        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Invalid JSON format',
        };
      }
    },
  };
});

