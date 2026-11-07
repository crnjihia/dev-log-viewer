// path: src/tests/search.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from '../store/searchStore';

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.getState().clearSearch();
  });

  it('initializes with default search options', () => {
    const s = useSearchStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.query).toBe('');
    expect(s.isCaseSensitive).toBe(false);
    expect(s.isWholeWord).toBe(false);
    expect(s.isRegex).toBe(false);
    expect(s.matches.length).toBe(0);
  });

  it('toggles search option flags', () => {
    const s = useSearchStore.getState();
    s.toggleCaseSensitive();
    expect(useSearchStore.getState().isCaseSensitive).toBe(true);

    s.toggleWholeWord();
    expect(useSearchStore.getState().isWholeWord).toBe(true);

    s.toggleRegex();
    expect(useSearchStore.getState().isRegex).toBe(true);
  });

  it('runs search and finds synthetic Daraja STK push and Africa Talking entries', async () => {
    const s = useSearchStore.getState();
    await s.setQuery('Daraja');

    const matches = useSearchStore.getState().matches;
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matches.length).toBeGreaterThan(0);
    expect(useSearchStore.getState().currentMatchIdx).toBe(0);
  });

  it('navigates next and previous matches with cyclic wrap', async () => {
    const s = useSearchStore.getState();
    await s.setQuery('M-Pesa');

    const matchCount = useSearchStore.getState().matches.length;
    if (matchCount > 1) {
      expect(useSearchStore.getState().currentMatchIdx).toBe(0);

      s.nextMatch();
      expect(useSearchStore.getState().currentMatchIdx).toBe(1);

      s.prevMatch();
      expect(useSearchStore.getState().currentMatchIdx).toBe(0);

      // Wrap backward to last item
      s.prevMatch();
      expect(useSearchStore.getState().currentMatchIdx).toBe(matchCount - 1);
    }
  });

  it('clears search state and closes search bar', async () => {
    const s = useSearchStore.getState();
    s.setIsOpen(true);
    await s.setQuery('STK');
    expect(useSearchStore.getState().matches.length).toBeGreaterThan(0);

    s.clearSearch();
    expect(useSearchStore.getState().query).toBe('');
    expect(useSearchStore.getState().matches.length).toBe(0);
    expect(useSearchStore.getState().isOpen).toBe(false);
  });
});
