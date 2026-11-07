// path: src/components/SearchToolbar.tsx

import React, { useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, Search, Loader2 } from 'lucide-react';
import { useSearchStore } from '../store/searchStore';

export const SearchToolbar: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    isCaseSensitive,
    toggleCaseSensitive,
    isWholeWord,
    toggleWholeWord,
    isRegex,
    toggleRegex,
    matches,
    currentMatchIdx,
    isSearching,
    nextMatch,
    prevMatch,
    clearSearch,
  } = useSearchStore();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearSearch();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
  };

  const countDisplay = isSearching
    ? 'Searching...'
    : matches.length > 0
    ? `${currentMatchIdx + 1} of ${matches.length.toLocaleString()}`
    : query.trim()
    ? 'No matches'
    : '';

  return (
    <div className="absolute top-3 right-6 z-40 bg-devlog-surface border border-devlog-border rounded-lg shadow-2xl p-1.5 flex items-center space-x-1.5 text-xs select-none backdrop-blur-md">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in logs (Enter / Shift+Enter)..."
          className="w-64 pl-7 pr-2 py-1 bg-devlog-bg border border-devlog-border rounded text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-devlog-accent"
        />
      </div>

      {/* Options: Case, Word, Regex */}
      <div className="flex items-center space-x-1 border-r border-devlog-border pr-1.5">
        <button
          onClick={toggleCaseSensitive}
          title="Match Case (Alt+C)"
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold transition-colors ${
            isCaseSensitive
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
        >
          Aa
        </button>

        <button
          onClick={toggleWholeWord}
          title="Match Whole Word (Alt+W)"
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold transition-colors ${
            isWholeWord
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
        >
          \b
        </button>

        <button
          onClick={toggleRegex}
          title="Use Regular Expression (Alt+R)"
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold transition-colors ${
            isRegex
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
        >
          .*
        </button>
      </div>

      {/* Match count badge */}
      <div className="min-w-[70px] text-center font-mono text-[11px] text-slate-400 px-1">
        {isSearching ? (
          <Loader2 className="w-3 h-3 animate-spin inline-block text-devlog-accent" />
        ) : (
          countDisplay
        )}
      </div>

      {/* Navigation Buttons: Prev & Next */}
      <div className="flex items-center space-x-0.5">
        <button
          onClick={prevMatch}
          disabled={matches.length === 0}
          title="Previous Match (Shift+Enter)"
          className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={nextMatch}
          disabled={matches.length === 0}
          title="Next Match (Enter)"
          className="p-1 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={() => setIsOpen(false)}
        title="Close (Escape)"
        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

