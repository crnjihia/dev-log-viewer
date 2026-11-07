// path: src/components/Header.tsx

import React, { useState } from 'react';
import {
  Terminal,
  CornerDownRight,
  WrapText,
  Globe2,
  Sparkles,
  Search,
  Filter,
  Bookmark,
  Activity,
  Command,
  Palette,
  Keyboard,
} from 'lucide-react';
import { useLogStore } from '../store/logStore';
import { useSearchStore } from '../store/searchStore';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { usePresetStore } from '../store/presetStore';
import { useThemeStore } from '../store/themeStore';
import { useKeymapStore } from '../store/keymapStore';
import { translations } from '../i18n/locales';

export const Header: React.FC = () => {
  const {
    locale,
    setLocale,
    activeFile,
    isWordWrap,
    toggleWordWrap,
    setJumpTarget,
    totalLines,
    loadSampleFixture,
    isTailFollow,
    toggleTailFollow,
  } = useLogStore();

  const { setIsOpen: setIsSearchOpen } = useSearchStore();
  const { toggleOpen: toggleJsonQuery, isOpen: isJsonQueryOpen } = useJsonQueryStore();
  const { togglePalette } = usePresetStore();
  const { toggleThemeModal } = useThemeStore();
  const { toggleCommandPalette, mode: keymapMode, setMode: setKeymapMode } = useKeymapStore();

  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  const t = translations[locale];

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const line = parseInt(jumpInput.trim(), 10);
    if (!isNaN(line) && line >= 1) {
      setJumpTarget(line);
      setIsJumpOpen(false);
      setJumpInput('');
    }
  };

  return (
    <>
      <header className="h-11 px-4 bg-devlog-surface border-b border-devlog-border flex items-center justify-between flex-shrink-0 select-none">
        {/* Left Branding & File Chip */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-devlog-accent" />
            <span className="font-semibold text-xs tracking-wide text-white">
              {t.appName}
            </span>
          </div>

          {activeFile && (
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-devlog-border text-[11px] text-slate-300 font-mono">
              <span className="truncate max-w-[200px]" title={activeFile.path}>
                {activeFile.path.split(/[/\\]/).pop()}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                {(activeFile.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          )}
        </div>

        {/* Center / Right Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Search Trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-devlog-border text-xs text-slate-300 transition-colors"
            title="Search logs (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* JSON Query Filter Trigger */}
          <button
            onClick={toggleJsonQuery}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs transition-colors ${
              isJsonQueryOpen
                ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300'
                : 'bg-slate-800/60 hover:bg-slate-700/60 border-devlog-border text-slate-300'
            }`}
            title="Filter with JSON query language"
          >
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">{t.structuredSearch}</span>
          </button>

          {/* Load Sample Dataset */}
          <button
            onClick={loadSampleFixture}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-devlog-border text-xs text-slate-300 transition-colors"
            title="Load synthetic Kenyan fintech log stream"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Sample 250k</span>
          </button>

          {/* Jump to Line Trigger */}
          <button
            onClick={() => setIsJumpOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-devlog-border text-xs text-slate-300 transition-colors"
            title="Jump to line number (Ctrl+G)"
          >
            <CornerDownRight className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.jumpToLine}</span>
          </button>

          {/* Presets Quick Switch */}
          <button
            onClick={togglePalette}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-devlog-border text-xs text-slate-300 transition-colors"
            title="Open filter presets (Ctrl+P)"
          >
            <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">{t.presets}</span>
          </button>

          {/* Live Tail Follow Mode Toggle */}
          <button
            onClick={toggleTailFollow}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs transition-colors ${
              isTailFollow
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse'
                : 'bg-slate-800/60 hover:bg-slate-700/60 border-devlog-border text-slate-400'
            }`}
            title="Auto-scroll to latest incoming logs (Shift+F)"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{isTailFollow ? t.followOn : t.followOff}</span>
          </button>

          {/* Word Wrap Toggle */}
          <button
            onClick={toggleWordWrap}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs transition-colors ${
              isWordWrap
                ? 'bg-blue-900/40 border-blue-500 text-blue-300'
                : 'bg-slate-800/60 hover:bg-slate-700/60 border-devlog-border text-slate-400'
            }`}
            title="Toggle word wrapping"
          >
            <WrapText className="w-3.5 h-3.5" />
            <span>{isWordWrap ? t.wrappingOn : t.wrappingOff}</span>
          </button>

          {/* Command Palette Trigger */}
          <button
            onClick={toggleCommandPalette}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 border border-devlog-border text-xs text-slate-200 transition-colors"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command className="w-3.5 h-3.5 text-devlog-accent" />
            <span className="hidden md:inline">{t.commandPalette}</span>
            <kbd className="hidden lg:inline text-[9px] px-1 py-0.2 bg-slate-900 border border-slate-700 rounded text-slate-400">Ctrl+K</kbd>
          </button>

          {/* Theme Picker Trigger */}
          <button
            onClick={toggleThemeModal}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Change theme or import JSON"
          >
            <Palette className="w-4 h-4 text-purple-400" />
          </button>

          {/* Keymap Mode Switcher */}
          <button
            onClick={() => setKeymapMode(keymapMode === 'vim' ? 'standard' : 'vim')}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800/60 border border-devlog-border text-[11px] text-slate-300 hover:text-white transition-colors"
            title="Toggle keymap mode (Vim / Standard)"
          >
            <Keyboard className="w-3 h-3 text-emerald-400" />
            <span className="font-mono text-[10px] uppercase font-bold">{keymapMode}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-800 text-xs text-slate-400 hover:text-white transition-colors"
            title="Badili lugha / Switch language"
          >
            <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold uppercase text-[10px]">{locale}</span>
          </button>
        </div>
      </header>

      {/* Jump to Line Modal Dialog */}
      {isJumpOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-devlog-surface border border-devlog-border rounded-lg shadow-xl w-full max-w-sm p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <CornerDownRight className="w-4 h-4 text-devlog-accent" />
              <span>{t.jumpModalTitle}</span>
            </h3>

            <form onSubmit={handleJumpSubmit} className="space-y-3">
              <input
                type="number"
                min="1"
                max={totalLines}
                autoFocus
                placeholder={`1 - ${totalLines.toLocaleString()}`}
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-devlog-bg border border-devlog-border text-white text-xs font-mono focus:outline-none focus:border-devlog-accent"
              />

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJumpOpen(false)}
                  className="px-3 py-1 rounded border border-devlog-border hover:bg-slate-800 text-xs text-slate-400"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-devlog-accent hover:bg-blue-600 text-white text-xs font-medium"
                >
                  {t.jumpButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
