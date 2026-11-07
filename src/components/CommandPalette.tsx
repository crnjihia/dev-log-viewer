// path: src/components/CommandPalette.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useLogStore } from '../store/logStore';
import { useSearchStore } from '../store/searchStore';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { usePresetStore } from '../store/presetStore';
import { useThemeStore } from '../store/themeStore';
import { useKeymapStore } from '../store/keymapStore';
import { translations } from '../i18n/locales';
import {
  Search,
  Filter,
  Bookmark,
  CornerDownRight,
  WrapText,
  Activity,
  Columns,
  Palette,
  Keyboard,
  Globe2,
  Copy,
  Sparkles,
  Command,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Filters & Search' | 'View' | 'Themes' | 'Actions';
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    locale,
    setLocale,
    toggleWordWrap,
    setJumpTarget,
    totalLines,
    selectedLine,
    loadSampleFixture,
    toggleTailFollow,
  } = useLogStore();

  const { setIsOpen: setIsSearchOpen } = useSearchStore();
  const { toggleOpen: toggleJsonQuery, toggleColumnView } = useJsonQueryStore();
  const { setIsPaletteOpen: setIsPresetsOpen } = usePresetStore();
  const { setTheme, toggleThemeModal } = useThemeStore();
  const { mode: keymapMode, setMode: setKeymapMode, getPrimaryShortcut } = useKeymapStore();

  const t = translations[locale];

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Filters & Search
    {
      id: 'cmd-search',
      title: 'Find in Logs (Regex / Substring)',
      category: 'Filters & Search',
      shortcut: getPrimaryShortcut('openSearch'),
      icon: <Search className="w-4 h-4 text-amber-400" />,
      action: () => {
        setIsSearchOpen(true);
        onClose();
      },
    },
    {
      id: 'cmd-json-filter',
      title: 'Filter with Structured JSON Query',
      category: 'Filters & Search',
      shortcut: getPrimaryShortcut('openJsonFilter'),
      icon: <Filter className="w-4 h-4 text-indigo-400" />,
      action: () => {
        toggleJsonQuery();
        onClose();
      },
    },
    {
      id: 'cmd-presets',
      title: 'Open Presets & Quick Switch Palette',
      category: 'Filters & Search',
      shortcut: getPrimaryShortcut('openPresets'),
      icon: <Bookmark className="w-4 h-4 text-blue-400" />,
      action: () => {
        setIsPresetsOpen(true);
        onClose();
      },
    },

    // Navigation
    {
      id: 'cmd-jump-line',
      title: 'Jump to Line Number...',
      category: 'Navigation',
      shortcut: 'Ctrl+G',
      icon: <CornerDownRight className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onClose();
        const lineStr = window.prompt(`Jump to line (1 - ${totalLines}):`);
        if (lineStr) {
          const num = parseInt(lineStr.trim(), 10);
          if (!isNaN(num) && num >= 1) setJumpTarget(num);
        }
      },
    },
    {
      id: 'cmd-jump-top',
      title: 'Jump to Top of File (Line 1)',
      category: 'Navigation',
      shortcut: getPrimaryShortcut('jumpTop'),
      icon: <ArrowUp className="w-4 h-4 text-cyan-400" />,
      action: () => {
        setJumpTarget(1);
        onClose();
      },
    },
    {
      id: 'cmd-jump-bottom',
      title: 'Jump to Bottom of File (Latest Line)',
      category: 'Navigation',
      shortcut: getPrimaryShortcut('jumpBottom'),
      icon: <ArrowDown className="w-4 h-4 text-cyan-400" />,
      action: () => {
        setJumpTarget(totalLines);
        onClose();
      },
    },

    // View & Layout
    {
      id: 'cmd-follow-mode',
      title: 'Toggle Live Tail Follow Mode',
      category: 'View',
      shortcut: getPrimaryShortcut('toggleFollow'),
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      action: () => {
        toggleTailFollow();
        onClose();
      },
    },
    {
      id: 'cmd-word-wrap',
      title: 'Toggle Word Wrapping',
      category: 'View',
      shortcut: getPrimaryShortcut('toggleWordWrap'),
      icon: <WrapText className="w-4 h-4 text-purple-400" />,
      action: () => {
        toggleWordWrap();
        onClose();
      },
    },
    {
      id: 'cmd-column-view',
      title: 'Toggle Column Extraction Table View',
      category: 'View',
      shortcut: getPrimaryShortcut('toggleColumns'),
      icon: <Columns className="w-4 h-4 text-indigo-400" />,
      action: () => {
        toggleColumnView();
        onClose();
      },
    },

    // Themes
    {
      id: 'cmd-theme-dark',
      title: 'Theme: Obsidian Dark',
      category: 'Themes',
      icon: <Palette className="w-4 h-4 text-slate-300" />,
      action: () => {
        setTheme('dark');
        onClose();
      },
    },
    {
      id: 'cmd-theme-light',
      title: 'Theme: Daylight Clean',
      category: 'Themes',
      icon: <Palette className="w-4 h-4 text-blue-300" />,
      action: () => {
        setTheme('light');
        onClose();
      },
    },
    {
      id: 'cmd-theme-high-contrast',
      title: 'Theme: High Contrast (WCAG AAA)',
      category: 'Themes',
      icon: <Palette className="w-4 h-4 text-yellow-300" />,
      action: () => {
        setTheme('high-contrast');
        onClose();
      },
    },
    {
      id: 'cmd-theme-dusk',
      title: 'Theme: Kenyan Dusk (Sunset Acacia)',
      category: 'Themes',
      icon: <Palette className="w-4 h-4 text-amber-500" />,
      action: () => {
        setTheme('kenyan-dusk');
        onClose();
      },
    },
    {
      id: 'cmd-theme-custom',
      title: 'Import Custom Theme JSON...',
      category: 'Themes',
      icon: <Palette className="w-4 h-4 text-purple-400" />,
      action: () => {
        onClose();
        toggleThemeModal();
      },
    },

    // Actions & Settings
    {
      id: 'cmd-keymap-toggle',
      title: `Switch Keymap (Current: ${keymapMode === 'vim' ? 'Vim' : 'Standard'})`,
      category: 'Actions',
      shortcut: 'Tab',
      icon: <Keyboard className="w-4 h-4 text-emerald-400" />,
      action: () => {
        setKeymapMode(keymapMode === 'vim' ? 'standard' : 'vim');
        onClose();
      },
    },
    {
      id: 'cmd-language-toggle',
      title: `Switch Language: ${locale === 'en' ? 'Kiswahili' : 'English'}`,
      category: 'Actions',
      icon: <Globe2 className="w-4 h-4 text-emerald-400" />,
      action: () => {
        setLocale(locale === 'en' ? 'sw' : 'en');
        onClose();
      },
    },
    {
      id: 'cmd-copy-line',
      title: 'Copy Selected Line to Clipboard',
      category: 'Actions',
      shortcut: getPrimaryShortcut('copyLine'),
      icon: <Copy className="w-4 h-4 text-slate-300" />,
      action: () => {
        if (selectedLine) {
          navigator.clipboard.writeText(selectedLine.text);
        }
        onClose();
      },
    },
    {
      id: 'cmd-load-sample',
      title: 'Load Synthetic Kenyan Fintech Stream (250k lines)',
      category: 'Actions',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      action: () => {
        loadSampleFixture();
        onClose();
      },
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase()) ||
      (c.shortcut && c.shortcut.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation within command palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-100"
    >
      <div className="bg-devlog-surface border border-devlog-border rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[70vh]">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-devlog-border bg-devlog-bg/80 flex items-center gap-2">
          <Command className="w-4 h-4 text-devlog-accent shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            placeholder={t.commandsSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none font-mono"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Listbox */}
        <div
          id="command-list"
          role="listbox"
          className="flex-1 overflow-y-auto divide-y divide-devlog-border/50 p-1"
        >
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No matching commands found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-devlog-accent/20 border-l-2 border-devlog-accent'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-white font-medium truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {item.shortcut && (
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 font-mono text-[10px] text-slate-300 shrink-0">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-devlog-border bg-devlog-bg/60 text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <span>↑↓ Navigate • Enter Run • Esc Close</span>
          <span>{filtered.length} actions</span>
        </div>
      </div>
    </div>
  );
};

