// path: src/components/PresetPalette.tsx

import React, { useState, useEffect, useRef } from 'react';
import { usePresetStore } from '../store/presetStore';
import { useSearchStore } from '../store/searchStore';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { useLogStore } from '../store/logStore';
import { translations } from '../i18n/locales';
import {
  Bookmark,
  Search,
  X,
  Trash2,
  Check,
  Plus,
} from 'lucide-react';

export const PresetPalette: React.FC = () => {
  const {
    isPaletteOpen,
    setIsPaletteOpen,
    presets,
    savePreset,
    deletePreset,
    applyPreset,
  } = usePresetStore();

  const { query: searchQuery, isRegex, isCaseSensitive, isWholeWord } = useSearchStore();
  const { query: jsonQuery } = useJsonQueryStore();
  const { locale } = useLogStore();
  const t = translations[locale];

  const [filterText, setFilterText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saveType, setSaveType] = useState<'json_query' | 'regex'>(
    jsonQuery.trim() ? 'json_query' : 'regex'
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const currentQueryToSave = saveType === 'json_query' ? jsonQuery : searchQuery;

  const filteredPresets = presets.filter(
    (p) =>
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      p.description.toLowerCase().includes(filterText.toLowerCase()) ||
      p.query.toLowerCase().includes(filterText.toLowerCase())
  );

  useEffect(() => {
    if (isPaletteOpen) {
      setFilterText('');
      setSelectedIndex(0);
      setIsSavingNew(false);
      setSaveType(jsonQuery.trim() ? 'json_query' : 'regex');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isPaletteOpen, jsonQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  // Keyboard navigation
  useEffect(() => {
    if (!isPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredPresets.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredPresets.length) % Math.max(1, filteredPresets.length)
        );
      } else if (e.key === 'Enter' && !isSavingNew) {
        e.preventDefault();
        if (filteredPresets[selectedIndex]) {
          applyPreset(filteredPresets[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, filteredPresets, selectedIndex, isSavingNew, applyPreset, setIsPaletteOpen]);

  if (!isPaletteOpen) return null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !currentQueryToSave.trim()) return;

    savePreset(
      newName.trim(),
      newDesc.trim(),
      saveType,
      currentQueryToSave.trim(),
      saveType === 'regex'
        ? { isRegex, isCaseSensitive, isWholeWord }
        : undefined
    );

    setIsSavingNew(false);
    setNewName('');
    setNewDesc('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[75vh]">
        {/* Modal Header */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {t.presetsPalette}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSavingNew(!isSavingNew)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border ${
                isSavingNew
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.savePreset}</span>
            </button>

            <button
              onClick={() => setIsPaletteOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Save Current Query Drawer */}
        {isSavingNew && (
          <form
            onSubmit={handleSaveSubmit}
            className="p-3.5 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2.5 text-xs animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[11px] shrink-0">Type:</span>
              <button
                type="button"
                onClick={() => setSaveType('json_query')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                  saveType === 'json_query'
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                JSON Query
              </button>
              <button
                type="button"
                onClick={() => setSaveType('regex')}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                  saveType === 'regex'
                    ? 'bg-amber-950 text-amber-300 border-amber-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                Regex / Plain
              </button>

              <span className="text-slate-500 truncate font-mono text-[11px] ml-auto">
                Query: {currentQueryToSave || '(empty)'}
              </span>
            </div>

            <input
              type="text"
              placeholder={t.presetName}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              autoFocus
              required
            />

            <input
              type="text"
              placeholder={t.presetDesc}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSavingNew(false)}
                className="px-3 py-1 rounded border border-slate-700 text-slate-400 hover:bg-slate-800"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={!newName.trim() || !currentQueryToSave.trim()}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
              >
                {t.save}
              </button>
            </div>
          </form>
        )}

        {/* Filter Input */}
        <div className="p-2.5 border-b border-slate-800 bg-slate-950/50 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to filter presets (e.g. Daraja, KES, SMS)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none font-mono"
          />
        </div>

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1">
          {filteredPresets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No matching presets found
            </div>
          ) : (
            filteredPresets.map((preset, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-lg flex items-start justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-950/60 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white truncate">
                        {preset.name}
                      </span>

                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                          preset.queryType === 'json_query'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {preset.queryType === 'json_query' ? 'JSON' : 'REGEX'}
                      </span>

                      {preset.isBuiltIn && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                          BUILT-IN
                        </span>
                      )}
                    </div>

                    <div className="font-mono text-[11px] text-indigo-300/90 truncate bg-slate-950 px-2 py-0.5 rounded border border-slate-800/80 max-w-lg">
                      {preset.query}
                    </div>

                    {preset.description && (
                      <span className="text-[11px] text-slate-400 truncate">
                        {preset.description}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        applyPreset(preset);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
                      title={t.apply}
                    >
                      <Check className="w-3 h-3" />
                      <span>{t.apply}</span>
                    </button>

                    {!preset.isBuiltIn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset(preset.id);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title={t.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-2 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <span>↑↓ Navigate • Enter Apply • Esc Dismiss</span>
          <span>{filteredPresets.length} presets</span>
        </div>
      </div>
    </div>
  );
};
