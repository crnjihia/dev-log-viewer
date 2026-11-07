// path: src/components/SideDetailPanel.tsx

import React, { useState } from 'react';
import { useLogStore } from '../store/logStore';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { translations } from '../i18n/locales';
import {
  X,
  Copy,
  Check,
  Code2,
  ListTree,
  FileText,
  Plus,
} from 'lucide-react';

interface JsonTreeNodeProps {
  keyName?: string;
  value: unknown;
  path: string;
  depth?: number;
  onFilter: (path: string, val: string | number | boolean) => void;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  keyName,
  value,
  path,
  depth = 0,
  onFilter,
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 3);

  if (value === null) {
    return (
      <div className="flex items-center gap-1 font-mono text-xs pl-4 hover:bg-slate-800/40 py-0.5 rounded">
        {keyName && <span className="text-cyan-400">"{keyName}":</span>}
        <span className="text-slate-500 italic">null</span>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-between font-mono text-xs pl-4 hover:bg-slate-800/40 py-0.5 rounded group">
        <div className="flex items-center gap-1">
          {keyName && <span className="text-cyan-400">"{keyName}":</span>}
          <span className="text-amber-400 font-semibold">{String(value)}</span>
        </div>
        <button
          onClick={() => onFilter(path, value)}
          className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center gap-0.5 transition-all"
          title="Filter by this value"
        >
          <Plus className="w-2.5 h-2.5" /> Filter
        </button>
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="flex items-center justify-between font-mono text-xs pl-4 hover:bg-slate-800/40 py-0.5 rounded group">
        <div className="flex items-center gap-1">
          {keyName && <span className="text-cyan-400">"{keyName}":</span>}
          <span className="text-purple-400 font-semibold">{value}</span>
        </div>
        <button
          onClick={() => onFilter(path, value)}
          className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center gap-0.5 transition-all"
          title="Filter by this value"
        >
          <Plus className="w-2.5 h-2.5" /> Filter
        </button>
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <div className="flex items-center justify-between font-mono text-xs pl-4 hover:bg-slate-800/40 py-0.5 rounded group">
        <div className="flex items-center gap-1 truncate max-w-[280px]">
          {keyName && <span className="text-cyan-400 shrink-0">"{keyName}":</span>}
          <span className="text-emerald-400 truncate" title={value}>
            "{value}"
          </span>
        </div>
        <button
          onClick={() => onFilter(path, value)}
          className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center gap-0.5 transition-all shrink-0"
          title="Filter by this value"
        >
          <Plus className="w-2.5 h-2.5" /> Filter
        </button>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="pl-4 font-mono text-xs py-0.5">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="cursor-pointer hover:text-slate-200 flex items-center gap-1 text-slate-400"
        >
          <span className="text-[10px] text-slate-500">{isExpanded ? '▼' : '▶'}</span>
          {keyName && <span className="text-cyan-400">"{keyName}":</span>}
          <span className="text-slate-400">[{value.length}]</span>
        </div>
        {isExpanded && (
          <div className="border-l border-slate-800 ml-2 pl-2 flex flex-col gap-0.5 mt-0.5">
            {value.map((item, idx) => (
              <JsonTreeNode
                key={idx}
                keyName={String(idx)}
                value={item}
                path={`${path}[${idx}]`}
                depth={depth + 1}
                onFilter={onFilter}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="pl-4 font-mono text-xs py-0.5">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="cursor-pointer hover:text-slate-200 flex items-center gap-1 text-slate-400"
        >
          <span className="text-[10px] text-slate-500">{isExpanded ? '▼' : '▶'}</span>
          {keyName && <span className="text-cyan-400">"{keyName}":</span>}
          <span className="text-slate-500">{'{'}</span>
          {!isExpanded && <span className="text-slate-500 text-[10px]">...</span>}
          {!isExpanded && <span className="text-slate-500">{'}'}</span>}
        </div>
        {isExpanded && (
          <div className="border-l border-slate-800 ml-2 pl-2 flex flex-col gap-0.5 mt-0.5">
            {entries.map(([k, v]) => (
              <JsonTreeNode
                key={k}
                keyName={k}
                value={v}
                path={path ? `${path}.${k}` : k}
                depth={depth + 1}
                onFilter={onFilter}
              />
            ))}
            <div className="text-slate-500 pl-4">{'}'}</div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export const SideDetailPanel: React.FC = () => {
  const { selectedLine, setSelectedLine, locale } = useLogStore();
  const { appendQueryClause } = useJsonQueryStore();
  const t = translations[locale];

  const [activeTab, setActiveTab] = useState<'tree' | 'fields' | 'raw'>('tree');
  const [copied, setCopied] = useState(false);

  if (!selectedLine) return null;

  let parsedJson: Record<string, unknown> | null = null;
  const trimmed = selectedLine.text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      parsedJson = null;
    }
  }

  const handleCopy = async () => {
    const content = parsedJson
      ? JSON.stringify(parsedJson, null, 2)
      : selectedLine.text;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFilterField = (field: string, val: string | number | boolean) => {
    appendQueryClause(field, ':', val);
  };

  // Flattened key-value pairs for Field Explorer tab
  const flattenedFields: Array<{ path: string; value: string; raw: string | number | boolean }> = [];
  function flatten(obj: unknown, prefix: string) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        flatten(v, prefix ? `${prefix}.${k}` : k);
      }
    } else {
      flattenedFields.push({
        path: prefix,
        value: typeof obj === 'string' ? obj : JSON.stringify(obj),
        raw: obj as string | number | boolean,
      });
    }
  }
  if (parsedJson) {
    flatten(parsedJson, '');
  }

  return (
    <div className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full z-40 backdrop-blur-md shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-indigo-400">
            {t.line} #{selectedLine.line_number}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
              selectedLine.level === 'error'
                ? 'bg-red-950 text-red-400 border border-red-800'
                : selectedLine.level === 'warn'
                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}
          >
            {selectedLine.level}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
            title={t.copyJson}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{copied ? 'Copied' : t.copyJson}</span>
          </button>

          <button
            onClick={() => setSelectedLine(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-xs bg-slate-950/40">
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'tree'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{t.parsedJson}</span>
        </button>

        <button
          onClick={() => setActiveTab('fields')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'fields'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <ListTree className="w-3.5 h-3.5" />
          <span>{t.fieldPicker}</span>
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-b-2 font-medium transition-colors ${
            activeTab === 'raw'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/40'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t.rawText}</span>
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {activeTab === 'tree' && (
          parsedJson ? (
            <div className="flex flex-col gap-0.5">
              <JsonTreeNode
                value={parsedJson}
                path=""
                onFilter={handleFilterField}
              />
            </div>
          ) : (
            <div className="text-slate-400 italic p-2 bg-slate-950/50 rounded border border-slate-800">
              Not a valid JSON line. Viewing as plain text.
              <pre className="mt-2 text-slate-200 whitespace-pre-wrap font-mono text-xs">
                {selectedLine.text}
              </pre>
            </div>
          )
        )}

        {activeTab === 'fields' && (
          <div className="flex flex-col gap-1.5">
            {flattenedFields.length === 0 ? (
              <div className="text-slate-500 text-center py-6">
                No structured fields extracted
              </div>
            ) : (
              flattenedFields.map(({ path, value, raw }) => (
                <div
                  key={path}
                  className="flex items-start justify-between p-2 rounded bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-colors group"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-cyan-400 font-semibold text-[11px] truncate">
                      {path}
                    </span>
                    <span className="text-slate-300 text-xs truncate select-all" title={value}>
                      {value}
                    </span>
                  </div>

                  <button
                    onClick={() => handleFilterField(path, raw)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center gap-1 transition-all shrink-0 mt-0.5"
                    title={t.filterByValue}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Filter</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
            <pre className="whitespace-pre-wrap break-all text-slate-300 leading-relaxed">
              {selectedLine.text}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Offset: {selectedLine.byte_offset.toLocaleString()} B</span>
        <span>Length: {selectedLine.byte_length.toLocaleString()} B</span>
      </div>
    </div>
  );
};
