// path: src/components/StructuredQueryBar.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { useLogStore } from '../store/logStore';
import { translations } from '../i18n/locales';
import {
  Filter,
  X,
  AlertCircle,
  Database,
  Columns,
  Check,
  ChevronDown,
} from 'lucide-react';

export const StructuredQueryBar: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    syntaxError,
    discoveredFields,
    sampleFieldsFromLines,
    matchingLines,
    isFiltering,
    filterOnlyMatching,
    toggleFilterOnlyMatching,
    isColumnView,
    toggleColumnView,
    clearQuery,
  } = useJsonQueryStore();

  const { locale, fetchWindow, totalLines } = useLogStore();
  const t = translations[locale];

  const [isFieldPickerOpen, setIsFieldPickerOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sample fields on initial load if empty
  useEffect(() => {
    if (isOpen && discoveredFields.length === 0) {
      fetchWindow(0, Math.min(totalLines, 300)).then((lines) => {
        sampleFieldsFromLines(lines.map((l) => l.text));
      });
    }
  }, [isOpen, discoveredFields.length, fetchWindow, totalLines, sampleFieldsFromLines]);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsFieldPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const filteredFields = discoveredFields.filter((f) =>
    f.path.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  const insertToken = (token: string) => {
    const el = inputRef.current;
    if (!el) {
      setQuery(query + token);
      return;
    }

    const start = el.selectionStart ?? query.length;
    const end = el.selectionEnd ?? query.length;
    const before = query.slice(0, start);
    const after = query.slice(end);

    const needsPreSpace = before.length > 0 && !before.endsWith(' ');
    const needsPostSpace = after.length > 0 && !after.startsWith(' ');

    const inserted = `${needsPreSpace ? ' ' : ''}${token}${needsPostSpace ? ' ' : ''}`;
    const newQuery = before + inserted + after;
    setQuery(newQuery);

    setTimeout(() => {
      el.focus();
      const newPos = start + inserted.length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  return (
    <div className="bg-slate-900/95 border-b border-indigo-500/20 px-3 py-2 text-xs flex flex-col gap-1.5 backdrop-blur-md shadow-lg z-30">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-indigo-400 font-semibold shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span>{t.structuredSearch}</span>
        </div>

        {/* Query Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.queryPlaceholder}
            className={`w-full bg-slate-950 px-2.5 py-1.5 rounded border font-mono text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors ${
              syntaxError
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700/60 focus:border-indigo-500'
            }`}
          />
          {query && (
            <button
              onClick={clearQuery}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              title={t.clearFilter}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Field Picker Dropdown Trigger */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setIsFieldPickerOpen(!isFieldPickerOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title={t.fieldPicker}
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.fieldPicker}</span>
            <span className="text-[10px] text-slate-400">({discoveredFields.length})</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Field Picker Dropdown Menu */}
          {isFieldPickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-72 max-h-80 bg-slate-900 border border-slate-700 rounded-md shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in duration-100">
              <div className="p-2 border-b border-slate-800 bg-slate-950">
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full bg-slate-900 px-2 py-1 text-xs rounded border border-slate-800 text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-800/40">
                {filteredFields.length === 0 ? (
                  <div className="p-3 text-slate-500 text-center text-xs">
                    {t.noFieldsFound}
                  </div>
                ) : (
                  filteredFields.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => {
                        insertToken(f.path + ':');
                        setIsFieldPickerOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-slate-800/80 transition-colors group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-mono text-slate-200 truncate group-hover:text-indigo-300">
                          {f.path}
                        </span>
                        {f.sampleValue && (
                          <span className="text-[10px] text-slate-500 truncate">
                            ex: {f.sampleValue}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider shrink-0 ${
                          f.type === 'number'
                            ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                            : f.type === 'boolean'
                            ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                            : f.type === 'array'
                            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                            : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                        }`}
                      >
                        {f.type.slice(0, 4)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter Only Matching Toggle */}
        <button
          onClick={toggleFilterOnlyMatching}
          className={`px-2 py-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
            filterOnlyMatching
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Only display matching lines"
        >
          <Check className={`w-3 h-3 ${filterOnlyMatching ? 'opacity-100' : 'opacity-40'}`} />
          <span>Filter View</span>
        </button>

        {/* Column Extraction View Toggle */}
        <button
          onClick={toggleColumnView}
          className={`px-2 py-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
            isColumnView
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title={t.columns}
        >
          <Columns className="w-3.5 h-3.5" />
          <span>{t.columns}</span>
        </button>

        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Syntax Error Banner */}
      {syntaxError && (
        <div className="flex items-center gap-2 text-red-400 bg-red-950/40 border border-red-500/30 px-2 py-1 rounded text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>
            {t.syntaxError} at pos {syntaxError.position}: {syntaxError.message}
          </span>
        </div>
      )}

      {/* Quick Helper Chips & Stats */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-mono">Insert:</span>
          {['AND', 'OR', 'NOT', '=', '!=', '>', '<'].map((tok) => (
            <button
              key={tok}
              onClick={() => insertToken(tok)}
              className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/60 font-mono text-[10px] text-slate-300 transition-colors"
            >
              {tok}
            </button>
          ))}
        </div>

        {query.trim() && !syntaxError && (
          <div className="flex items-center gap-2 text-slate-400">
            {isFiltering ? (
              <span className="text-indigo-400 animate-pulse">Filtering...</span>
            ) : (
              <span>
                <strong className="text-indigo-300">{matchingLines.length}</strong> matching lines
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

