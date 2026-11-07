// path: src/tests/keyboard_and_themes.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../store/themeStore';
import { useKeymapStore } from '../store/keymapStore';

describe('Themes and Keyboard UX Store Tests', () => {
  beforeEach(() => {
    useThemeStore.getState().setTheme('dark');
    useKeymapStore.getState().setMode('vim');
  });

  it('switches between built-in themes and updates state', () => {
    const store = useThemeStore.getState();

    store.setTheme('light');
    expect(useThemeStore.getState().currentTheme).toBe('light');

    store.setTheme('high-contrast');
    expect(useThemeStore.getState().currentTheme).toBe('high-contrast');

    store.setTheme('kenyan-dusk');
    expect(useThemeStore.getState().currentTheme).toBe('kenyan-dusk');

    store.setTheme('dark');
    expect(useThemeStore.getState().currentTheme).toBe('dark');
  });

  it('validates custom JSON theme imports and reports missing properties', () => {
    const store = useThemeStore.getState();

    // Invalid JSON
    const res1 = store.applyCustomThemeJson('{ broken json ');
    expect(res1.success).toBe(false);
    expect(res1.error).toBeDefined();

    // Missing colors object
    const res2 = store.applyCustomThemeJson('{"name": "No Colors"}');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("'colors' object");

    // Missing required color property 'bg'
    const res3 = store.applyCustomThemeJson(
      JSON.stringify({
        name: 'Incomplete',
        colors: {
          surface: '#111111',
          border: '#222222',
        },
      })
    );
    expect(res3.success).toBe(false);
    expect(res3.error).toContain('colors.bg');
  });

  it('successfully applies a valid custom theme JSON', () => {
    const store = useThemeStore.getState();

    const validCustom = {
      name: 'Nairobi Neon',
      description: 'Custom cyberpunk neon theme',
      colors: {
        bg: '#050508',
        surface: '#0f0e1c',
        border: '#262340',
        text: '#eae8ff',
        textMuted: '#6e6994',
        accent: '#00f5ff',
        error: '#ff0055',
        warn: '#ffaa00',
        info: '#00ccff',
        success: '#00ff88',
        debug: '#8888aa',
      },
    };

    const res = store.applyCustomThemeJson(JSON.stringify(validCustom));
    expect(res.success).toBe(true);

    const state = useThemeStore.getState();
    expect(state.currentTheme).toBe('custom');
    expect(state.customTheme).toBeDefined();
    expect(state.customTheme?.name).toBe('Nairobi Neon');
    expect(state.customTheme?.colors.accent).toBe('#00f5ff');
  });

  it('switches keymap modes between vim and standard', () => {
    const keymap = useKeymapStore.getState();

    // Default is vim
    expect(keymap.mode).toBe('vim');
    expect(keymap.getPrimaryShortcut('openSearch')).toBe('/');
    expect(keymap.getPrimaryShortcut('moveDown')).toBe('j');
    expect(keymap.getPrimaryShortcut('jumpTop')).toBe('g g');

    // Switch to standard
    keymap.setMode('standard');
    expect(useKeymapStore.getState().mode).toBe('standard');
    expect(useKeymapStore.getState().getPrimaryShortcut('openSearch')).toBe('Ctrl+f');
    expect(useKeymapStore.getState().getPrimaryShortcut('moveDown')).toBe('ArrowDown');
    expect(useKeymapStore.getState().getPrimaryShortcut('jumpTop')).toBe('Home');
  });
});
