// path: src/components/ColumnExtractionView.tsx

import React from 'react';
import { useJsonQueryStore } from '../store/jsonQueryStore';
import { useLogStore } from '../store/logStore';
import { resolveField } from '../utils/jsonQuery';
import { LineMeta } from '../types';
import { Plus, X, Columns as ColumnsIcon } from 'lucide-react';

interface ColumnExtractionViewProps {
  lines: LineMeta[];
}

export const ColumnExtractionView: React.FC<ColumnExtractionViewProps> = ({ lines }) => {
  const {
    selectedColumns,
    toggleColumn,
    discoveredFields,
    appendQueryClause,
  } = useJsonQueryStore();

  const { selectedLine, setSelectedLine } = useLogStore();

  const handleCellClick = (field: string, val: unknown) => {
    if (val !== undefined && val !== null) {
      appendQueryClause(field, ':', String(val));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 select-text">
      {/* Column Config Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
            <ColumnsIcon className="w-3.5 h-3.5 text-indigo-400" /> Active Columns:
          </span>
          {selectedColumns.map((col) => (
            <span
              key={col}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-indigo-300 text-[11px]"
            >
              {col}
              <button
                onClick={() => toggleColumn(col)}
                className="text-slate-400 hover:text-red-400 ml-0.5"
                title={`Remove ${col} column`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Dropdown to add columns */}
        <div className="relative group">
          <button className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors">
            <Plus className="w-3 h-3 text-indigo-400" />
            <span>Add Column</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-52 max-h-60 bg-slate-900 border border-slate-700 rounded shadow-xl hidden group-hover:flex flex-col overflow-y-auto z-50 p-1">
            {discoveredFields.map((f) => (
              <button
                key={f.path}
                onClick={() => toggleColumn(f.path)}
                className={`px-2 py-1 text-left text-xs font-mono rounded flex items-center justify-between ${
                  selectedColumns.includes(f.path)
                    ? 'bg-indigo-950 text-indigo-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{f.path}</span>
                {selectedColumns.includes(f.path) && (
                  <span className="text-[10px] text-indigo-400">active</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Structured Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs text-left">
          <thead className="bg-slate-900/90 sticky top-0 z-20 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider backdrop-blur-sm">
            <tr>
              <th className="py-2 px-3 w-16 text-right border-r border-slate-800/60 text-slate-500 font-normal">
                #
              </th>
              {selectedColumns.map((col) => (
                <th key={col} className="py-2 px-3 border-r border-slate-800/60 font-semibold text-slate-300">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {lines.map((line) => {
              let parsed: Record<string, unknown> | null = null;
              const trimmed = line.text.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                  parsed = JSON.parse(trimmed);
                } catch {
                  parsed = null;
                }
              }

              const isSelected = selectedLine?.line_number === line.line_number;

              return (
                <tr
                  key={line.line_number}
                  onClick={() => setSelectedLine(line)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-950/70 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-900/60'
                  }`}
                >
                  <td className="py-1 px-3 text-right text-slate-500 text-[11px] border-r border-slate-800/40 select-none">
                    {line.line_number}
                  </td>
                  {selectedColumns.map((col) => {
                    const val = parsed ? resolveField(parsed, col) : undefined;
                    let displayVal: string;
                    if (val === undefined || val === null) {
                      displayVal = '-';
                    } else if (typeof val === 'object') {
                      displayVal = JSON.stringify(val);
                    } else {
                      displayVal = String(val);
                    }

                    const isLevel = col === 'level';

                    return (
                      <td
                        key={col}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(col, val);
                        }}
                        className="py-1 px-3 border-r border-slate-800/40 truncate max-w-xs hover:text-indigo-300 transition-colors"
                        title={displayVal}
                      >
                        {isLevel ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              displayVal.toLowerCase() === 'error'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : displayVal.toLowerCase() === 'warn'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {displayVal}
                          </span>
                        ) : (
                          <span className={val === undefined ? 'text-slate-600' : 'text-slate-200'}>
                            {displayVal}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

