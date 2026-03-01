import React, { useState, useCallback } from 'react';
import { Edit3, ChevronUp, ChevronDown, Calendar } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers (pure functions, no re-creation per render)
// ---------------------------------------------------------------------------
const DATE_MONTH_REGEX = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_SLASH_REGEX = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;

const detectDate = (val) => {
    if (!val || typeof val !== 'string') return false;
    return DATE_MONTH_REGEX.test(val) || DATE_ISO_REGEX.test(val) || DATE_SLASH_REGEX.test(val);
};

const toISO = (val) => {
    if (!val) return '';
    if (DATE_ISO_REGEX.test(val)) return val; // already ISO
    try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    } catch (e) { /* ignore */ }
    return '';
};

// ---------------------------------------------------------------------------
// ZoneEditor — standalone component (NOT defined inside parent)
// ---------------------------------------------------------------------------
export default function ZoneEditor({ zone, onCellChange, title, icon, defaultExpanded = false }) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Compute visible rows (those with at least 1 non-empty cell)
    const visibleRows = React.useMemo(() => {
        return zone.map((row, rowIdx) => {
            const nonEmptyCells = row.cells.filter(c => c.value && c.value.trim() !== '');
            return { rowIdx, cells: nonEmptyCells };
        }).filter(r => r.cells.length > 0);
    }, [zone]);

    const handleToggle = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    if (visibleRows.length === 0) return null;

    return (
        <div className="bg-slate-50 rounded-lg border border-slate-200 mb-3">
            {/* Header bar — click to toggle */}
            <div
                className="px-3 py-2 flex items-center gap-2 border-b border-slate-200 bg-slate-100 rounded-t-lg cursor-pointer hover:bg-slate-200/70 transition-colors select-none"
                onClick={handleToggle}
            >
                {icon}
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
                <span className="text-[10px] text-slate-400 ml-1">({visibleRows.length} dòng)</span>
                <button
                    className={`ml-auto p-1 rounded transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
                    title={isExpanded ? 'Thu gọn' : 'Bấm để sửa'}
                    tabIndex={-1}
                >
                    <Edit3 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Expanded: editable cells */}
            {isExpanded && (
                <div className="p-2 space-y-1 max-h-[280px] overflow-y-auto">
                    {visibleRows.map(({ rowIdx, cells }) => (
                        <div key={rowIdx} className="flex flex-wrap gap-1 items-center">
                            {cells.map((cell) => {
                                const isDate = detectDate(cell.value);
                                const isoVal = isDate ? toISO(cell.value) : '';

                                // Find the actual index in the original zone row
                                const originalCellIdx = zone[rowIdx].cells.findIndex(c => c.col === cell.col);

                                return isDate && isoVal ? (
                                    <div key={cell.col} className="relative flex-1 min-w-[140px] max-w-[180px]">
                                        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
                                        <input
                                            type="date"
                                            className="w-full text-xs pl-6 pr-2 py-1.5 border border-blue-200 rounded bg-blue-50 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-colors"
                                            value={isoVal}
                                            onChange={(e) => {
                                                // Store as ISO — will be formatted on export
                                                onCellChange(rowIdx, originalCellIdx, e.target.value);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <input
                                        key={cell.col}
                                        type="text"
                                        className="flex-1 min-w-[80px] max-w-[220px] text-xs px-2 py-1.5 border border-slate-200 rounded bg-white hover:border-indigo-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none transition-colors"
                                        value={cell.value}
                                        title={cell.value}
                                        onChange={(e) => onCellChange(rowIdx, originalCellIdx, e.target.value)}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* Collapsed: summary preview */}
            {!isExpanded && (
                <div className="px-3 py-1.5 text-[11px] text-slate-500 truncate">
                    {visibleRows.slice(0, 2).map(r =>
                        r.cells.map(c => c.value).filter(Boolean).join(' | ')
                    ).join(' • ')}
                    {visibleRows.length > 2 && ' ...'}
                </div>
            )}
        </div>
    );
}
