// path: src/components/ThemeModal.tsx

import React, { useState } from 'react';
import { useThemeStore, BUILTIN_THEMES, ThemeId } from '../store/themeStore';
import { useLogStore } from '../store/logStore';
import { translations } from '../i18n/locales';
import { Palette, X, Check, AlertCircle, Code } from 'lucide-react';

const SAMPLE_CUSTOM_JSON = JSON.stringify(
  {
    name: 'Nairobi Cyberpunk',
    description: 'High energy neon cyan and magenta theme',
    colors: {
      bg: '#0a0a12',
      surface: '#121124',
      border: '#28234d',
      text: '#e0e7ff',
      textMuted: '#7971a8',
      accent: '#06b6d4',
      error: '#f43f5e',
      warn: '#fbbf24',
      info: '#38bdf8',
      success: '#10b981',
      debug: '#818cf8',
    },
  },
  null,
  2
);

export const ThemeModal: React.FC = () => {
  const {
    currentTheme,
    setTheme,
    isThemeModalOpen,
    setIsThemeModalOpen,
    applyCustomThemeJson,
  } = useThemeStore();

  const { locale } = useLogStore();
  const t = translations[locale];

  const [jsonInput, setJsonInput] = useState(SAMPLE_CUSTOM_JSON);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isThemeModalOpen) return null;

  const handleApplyJson = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = applyCustomThemeJson(jsonInput);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to apply theme');
    } else {
      setSuccessMessage('Theme applied and saved successfully!');
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const themeList: { id: ThemeId; label: string; desc: string; colors: string[] }[] = [
    {
      id: 'dark',
      label: t.themeDark,
      desc: BUILTIN_THEMES.dark.description,
      colors: ['#0d1117', '#161b22', '#38bdf8', '#f85149'],
    },
    {
      id: 'light',
      label: t.themeLight,
      desc: BUILTIN_THEMES.light.description,
      colors: ['#f8fafc', '#ffffff', '#0284c7', '#dc2626'],
    },
    {
      id: 'high-contrast',
      label: t.themeHighContrast,
      desc: BUILTIN_THEMES['high-contrast'].description,
      colors: ['#000000', '#ffffff', '#ffff00', '#ff3333'],
    },
    {
      id: 'kenyan-dusk',
      label: t.themeKenyanDusk,
      desc: BUILTIN_THEMES['kenyan-dusk'].description,
      colors: ['#140d0a', '#1f1410', '#f97316', '#ef4444'],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Theme Configuration"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-100"
    >
      <div className="bg-devlog-surface border border-devlog-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="p-3.5 border-b border-devlog-border bg-devlog-bg/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-devlog-accent" />
            <h2 className="text-sm font-semibold text-white tracking-wide">{t.theme}</h2>
          </div>
          <button
            onClick={() => setIsThemeModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Built-in Theme Picker Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {themeList.map((item) => {
              const isSelected = currentTheme === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTheme(item.id)}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-devlog-accent bg-devlog-accent/15 shadow-sm ring-1 ring-devlog-accent'
                      : 'border-devlog-border bg-slate-900/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-white">{item.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-devlog-accent" />}
                  </div>

                  <div className="flex items-center gap-1.5 my-2">
                    {item.colors.map((c, i) => (
                      <span
                        key={i}
                        className="w-4 h-4 rounded-full border border-black/40"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <span className="text-[10px] text-slate-400 leading-tight">
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Theme JSON Section */}
          <form onSubmit={handleApplyJson} className="space-y-2.5 pt-2 border-t border-devlog-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>{t.importTheme}</span>
              </span>
              <button
                type="button"
                onClick={() => setJsonInput(SAMPLE_CUSTOM_JSON)}
                className="text-[10px] text-devlog-accent hover:underline font-mono"
              >
                Reset to Cyberpunk Sample
              </button>
            </div>

            <textarea
              rows={8}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full bg-slate-950 border border-devlog-border rounded p-2.5 font-mono text-[11px] text-slate-200 outline-none focus:border-devlog-accent"
            />

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-950/40 border border-red-800/60 p-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs bg-emerald-950/40 border border-emerald-800/60 p-2 rounded">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-devlog-accent hover:bg-blue-600 text-white text-xs font-medium transition-colors"
              >
                {t.applyTheme}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

