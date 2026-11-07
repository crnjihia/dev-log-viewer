// path: src/App.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { LogViewer } from './components/LogViewer';
import { StatusBar } from './components/StatusBar';
import { PresetPalette } from './components/PresetPalette';
import { CommandPalette } from './components/CommandPalette';
import { ThemeModal } from './components/ThemeModal';
import { useLogStore } from './store/logStore';
import { useSearchStore } from './store/searchStore';
import { useJsonQueryStore } from './store/jsonQueryStore';
import { usePresetStore } from './store/presetStore';
import { useKeymapStore } from './store/keymapStore';

export const App: React.FC = () => {
  const {
    toggleWordWrap,
    setJumpTarget,
    totalLines,
    selectedLine,
    setSelectedLine,
    isTailFollow,
    toggleTailFollow,
    appendSyntheticLines,
    notification,
  } = useLogStore();

  const {
    setIsOpen: setIsSearchOpen,
    nextMatch,
    prevMatch,
    matches: searchMatches,
    query: searchQuery,
  } = useSearchStore();

  const { toggleOpen: toggleJsonQuery, matchingLines, query: jsonQuery } = useJsonQueryStore();
  const { togglePalette } = usePresetStore();
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    toggleCommandPalette,
    mode: keymapMode,
  } = useKeymapStore();

  // Screen-reader announcement text
  const [announcement, setAnnouncement] = useState('');

  // Two-key buffer for Vim sequences ('gg', 'yy')
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);

  // Announce search result count to screen readers
  useEffect(() => {
    if (searchQuery.trim()) {
      setAnnouncement(`Found ${searchMatches.length} search matches for query ${searchQuery}`);
    }
  }, [searchMatches.length, searchQuery]);

  // Announce JSON filter results
  useEffect(() => {
    if (jsonQuery.trim()) {
      setAnnouncement(`Structured filter matched ${matchingLines.length} lines`);
    }
  }, [matchingLines.length, jsonQuery]);

  // Announce notifications
  useEffect(() => {
    if (notification) {
      setAnnouncement(notification);
    }
  }, [notification]);

  // Simulated live tail streaming ticker when follow mode is active
  useEffect(() => {
    if (!isTailFollow) return;
    const interval = setInterval(() => {
      appendSyntheticLines(1);
    }, 1500);
    return () => clearInterval(interval);
  }, [isTailFollow, appendSyntheticLines]);

  // Global & Vim navigation keyboard event handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputActive =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Universal shortcuts (active even when not in inputs)
      // Ctrl+K / Cmd+K / F1 / Ctrl+Shift+P: Command Palette
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'P') ||
        e.key === 'F1'
      ) {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // If an input is currently active and it's not Escape, let input handle typing
      if (isInputActive && e.key !== 'Escape') {
        return;
      }

      // Escape: Dismiss selection / modals / focus
      if (e.key === 'Escape') {
        if (selectedLine) {
          setSelectedLine(null);
        }
        return;
      }

      // Ctrl+F / Cmd+F: Open search toolbar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Ctrl+P / Cmd+P: Open presets palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        togglePalette();
        return;
      }

      // Ctrl+J / Cmd+J: Toggle JSON query bar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleJsonQuery();
        return;
      }

      // Alt+Z: Toggle word wrap
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        toggleWordWrap();
        return;
      }

      // F3 / Shift+F3: Next / Previous search match
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) prevMatch();
        else nextMatch();
        return;
      }

      // Standard Navigation Keys
      if (e.key === 'Home') {
        e.preventDefault();
        setJumpTarget(1);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setJumpTarget(totalLines);
        return;
      }
      if (e.key === 'PageDown' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        const cur = selectedLine?.line_number ?? 1;
        const target = Math.min(totalLines, cur + 30);
        setJumpTarget(target);
        return;
      }
      if (e.key === 'PageUp' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        const cur = selectedLine?.line_number ?? 1;
        const target = Math.max(1, cur - 30);
        setJumpTarget(target);
        return;
      }

      // Standalone Shift+F: Toggle follow mode
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.toUpperCase() === 'F') {
        e.preventDefault();
        toggleTailFollow();
        return;
      }

      // Copy active line (Ctrl+C / Cmd+C when no text is highlighted)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        if (selectedLine) {
          navigator.clipboard.writeText(selectedLine.text);
        }
        return;
      }

      // Vim-style keybindings (active when not in an input)
      if (!isInputActive) {
        const now = Date.now();
        const lastKey = lastKeyRef.current;

        // Vim 'j' or ArrowDown: Move down 1 line
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          const cur = selectedLine?.line_number ?? 1;
          const next = Math.min(totalLines, cur + 1);
          setJumpTarget(next);
          return;
        }

        // Vim 'k' or ArrowUp: Move up 1 line
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          const cur = selectedLine?.line_number ?? 1;
          const prev = Math.max(1, cur - 1);
          setJumpTarget(prev);
          return;
        }

        // Vim 'G': Jump to bottom
        if (e.key === 'G') {
          e.preventDefault();
          setJumpTarget(totalLines);
          return;
        }

        // Vim 'gg': Jump to top (line 1)
        if (e.key === 'g') {
          if (lastKey && lastKey.key === 'g' && now - lastKey.time < 500) {
            e.preventDefault();
            setJumpTarget(1);
            lastKeyRef.current = null;
            return;
          } else {
            lastKeyRef.current = { key: 'g', time: now };
            return;
          }
        }

        // Vim 'yy': Yank / copy line
        if (e.key === 'y') {
          if (lastKey && lastKey.key === 'y' && now - lastKey.time < 500) {
            e.preventDefault();
            if (selectedLine) {
              navigator.clipboard.writeText(selectedLine.text);
            }
            lastKeyRef.current = null;
            return;
          } else {
            lastKeyRef.current = { key: 'y', time: now };
            return;
          }
        }

        // Vim '/': Focus regex search
        if (e.key === '/') {
          e.preventDefault();
          setIsSearchOpen(true);
          return;
        }

        // Vim '?': Focus structured JSON filter
        if (e.key === '?') {
          e.preventDefault();
          toggleJsonQuery();
          return;
        }

        // Vim 'n': Next search match
        if (e.key === 'n') {
          e.preventDefault();
          nextMatch();
          return;
        }

        // Vim 'N': Previous search match
        if (e.key === 'N') {
          e.preventDefault();
          prevMatch();
          return;
        }

        // Vim 'f': Toggle follow mode
        if (e.key === 'f') {
          e.preventDefault();
          toggleTailFollow();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    keymapMode,
    toggleWordWrap,
    setJumpTarget,
    totalLines,
    selectedLine,
    setSelectedLine,
    setIsSearchOpen,
    toggleJsonQuery,
    togglePalette,
    toggleCommandPalette,
    toggleTailFollow,
    nextMatch,
    prevMatch,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen bg-devlog-bg text-devlog-text overflow-hidden select-none">
      {/* Screen-reader Live Region for WCAG accessibility */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <Header />
      <LogViewer />
      <StatusBar />

      {/* Floating Modals and Palettes */}
      <PresetPalette />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <ThemeModal />
    </div>
  );
};
