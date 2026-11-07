// path: src/tests/preset_and_tail.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { usePresetStore, BUILTIN_PRESETS } from '../store/presetStore';
import { useLogStore } from '../store/logStore';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { useSearchStore } from '../store/searchStore';

// In-memory localStorage polyfill for Node.js test environment
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage?.clear) {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  } as Storage;
}

describe('Filter Presets & Live Tail Follow Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    usePresetStore.getState().loadPresets();
    useLogStore.setState({
      totalLines: 100,
      isTailFollow: false,
      jumpTarget: null,
      notification: null,
    });
  });

  it('provides built-in Kenyan fintech operational presets', () => {
    const { presets } = usePresetStore.getState();
    expect(presets.length).toBeGreaterThanOrEqual(6);

    const names = presets.map((p) => p.name);
    expect(names).toContain('Daraja STK Failures');
    expect(names).toContain('M-Pesa Settlements >= KES 10,000');
    expect(names).toContain("Africa's Talking SMS Failures");
    expect(names).toContain('Slow Latency (>1000ms)');
    expect(names).toContain('Failed STK Push ResultCodes');
  });

  it('saves and persists user presets to localStorage', () => {
    const store = usePresetStore.getState();
    store.savePreset(
      'Custom Timeout Filter',
      'Filters gateway timeouts',
      'json_query',
      'service:"daraja" AND duration_ms>2000'
    );

    const updated = usePresetStore.getState().presets;
    const custom = updated.find((p) => p.name === 'Custom Timeout Filter');
    expect(custom).toBeDefined();
    expect(custom?.isBuiltIn).toBe(false);
    expect(custom?.query).toBe('service:"daraja" AND duration_ms>2000');

    // Verify localStorage persistence
    const rawStored = localStorage.getItem('dev_log_viewer_presets_v1');
    expect(rawStored).toBeDefined();
    expect(rawStored).toContain('Custom Timeout Filter');
  });

  it('prevents deletion of built-in presets while allowing user preset deletion', () => {
    const store = usePresetStore.getState();
    const builtInId = BUILTIN_PRESETS[0].id;

    // Attempting to delete a built-in preset has no effect
    store.deletePreset(builtInId);
    expect(usePresetStore.getState().presets.some((p) => p.id === builtInId)).toBe(true);

    // Save user preset and then delete it
    store.savePreset('Temporary Filter', 'Temp', 'regex', 'ERROR');
    const userPreset = usePresetStore.getState().presets.find((p) => p.name === 'Temporary Filter');
    expect(userPreset).toBeDefined();

    store.deletePreset(userPreset!.id);
    expect(usePresetStore.getState().presets.some((p) => p.id === userPreset!.id)).toBe(false);
  });

  it('applies presets to respective search and json query stores', () => {
    const presetStore = usePresetStore.getState();

    // 1. Apply JSON preset
    const jsonPreset = BUILTIN_PRESETS.find((p) => p.queryType === 'json_query')!;
    presetStore.applyPreset(jsonPreset);
    expect(useJsonQueryStore.getState().isOpen).toBe(true);
    expect(useJsonQueryStore.getState().query).toBe(jsonPreset.query);

    // 2. Apply Regex preset
    const regexPreset = BUILTIN_PRESETS.find((p) => p.queryType === 'regex')!;
    presetStore.applyPreset(regexPreset);
    expect(useSearchStore.getState().isOpen).toBe(true);
    expect(useSearchStore.getState().query).toBe(regexPreset.query);
  });

  it('increments lines and updates jump target in tail follow mode', () => {
    const logStore = useLogStore.getState();
    logStore.setIsTailFollow(true);
    expect(useLogStore.getState().isTailFollow).toBe(true);

    // Append 5 lines
    logStore.appendSyntheticLines(5);

    const state = useLogStore.getState();
    expect(state.totalLines).toBe(105);
    expect(state.jumpTarget).toBe(105); // Follow mode jumps to bottom
  });
});
