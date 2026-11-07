// path: src/tests/virtual_view.test.ts

import { describe, it, expect } from 'vitest';
import { useLogStore } from '../store/logStore';

describe('useLogStore Virtual View State', () => {
  it('initializes with default Nairobi localization and English locale', () => {
    const store = useLogStore.getState();
    expect(store.locale).toBe('en');
    expect(store.totalLines).toBeGreaterThan(0);
    expect(store.isWordWrap).toBe(false);
  });

  it('toggles locale between English and Swahili', () => {
    const store = useLogStore.getState();
    store.setLocale('sw');
    expect(useLogStore.getState().locale).toBe('sw');
    store.setLocale('en');
    expect(useLogStore.getState().locale).toBe('en');
  });

  it('toggles word wrap flag', () => {
    const initial = useLogStore.getState().isWordWrap;
    useLogStore.getState().toggleWordWrap();
    expect(useLogStore.getState().isWordWrap).toBe(!initial);
    useLogStore.getState().toggleWordWrap();
    expect(useLogStore.getState().isWordWrap).toBe(initial);
  });

  it('fetches line window with synthetic Kenyan fintech data', async () => {
    const store = useLogStore.getState();
    const windowLines = await store.fetchWindow(100, 10);

    expect(windowLines.length).toBe(10);
    expect(windowLines[0].line_number).toBe(101);
    expect(windowLines[9].line_number).toBe(110);

    // Verify Nairobi EAT timestamp
    expect(windowLines[0].text).toContain('+03:00');
    // Verify phone number / receipt / KES amount presence
    const hasKenyanContext = windowLines.some(
      (l) => l.text.includes('+254') || l.text.includes('SYN-KES-') || l.text.includes('KES')
    );
    expect(hasKenyanContext).toBe(true);
  });

  it('handles jump target line updates', () => {
    const store = useLogStore.getState();
    store.setJumpTarget(5000);
    expect(useLogStore.getState().jumpTarget).toBe(5000);
    store.setJumpTarget(null);
    expect(useLogStore.getState().jumpTarget).toBeNull();
  });
});

