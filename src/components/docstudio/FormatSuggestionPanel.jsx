import React from 'react';
import { Check, CheckCheck, ChevronDown, Sparkles, AlertCircle } from 'lucide-react';
import { FORMAT_TYPES, FORMAT_LABELS, FORMAT_COLORS } from '../../lib/docstudio/formatSuggester';

/**
 * FormatSuggestionPanel
 * Displays format suggestions for each text block with accept/reject controls.
 * User can change suggestion type via dropdown, then accept all.
 */

const ALL_TYPES = Object.values(FORMAT_TYPES).filter(t => t !== 'page_break' && t !== 'table_row');

const ConfidenceDot = ({ confidence }) => {
    const colors = {
        high: 'bg-emerald-400',
        medium: 'bg-amber-400',
        low: 'bg-rose-400',
    };
    return (
        <span className={`inline-block w-2 h-2 rounded-full ${colors[confidence] || colors.low}`}
            title={confidence} />
    );
};

export default function FormatSuggestionPanel({
    suggestions,
    onUpdateSuggestion,
    onAcceptAll,
    displayLang = 'vn',
    i18n = {},
}) {
    if (!suggestions || suggestions.length === 0) return null;

    const labels = FORMAT_LABELS[displayLang] || FORMAT_LABELS.vn;

    return (
        <div className="bg-white border border-indigo-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[60vh]">
            {/* Header */}
            <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        {i18n.panelTitle || 'Format Suggestions'}
                    </span>
                    <span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                        {suggestions.length}
                    </span>
                </div>
                <button
                    onClick={onAcceptAll}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                >
                    <CheckCheck size={14} /> {i18n.acceptAll || 'Accept All'}
                </button>
            </div>

            {/* Suggestion List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-slate-100">
                {suggestions.map((sug, idx) => {
                    const colors = FORMAT_COLORS[sug.suggestedType] || FORMAT_COLORS.body_text;
                    // Skip rendering table separator rows
                    if (sug.suggestedType === FORMAT_TYPES.TABLE_ROW && /^[\s|:-]+$/.test(sug.text)) return null;

                    return (
                        <div key={sug.id} className="p-3 hover:bg-slate-50/50 transition-colors group">
                            <div className="flex items-start gap-3">
                                {/* Line number */}
                                <span className="text-[10px] text-slate-400 font-mono w-6 text-right shrink-0 pt-1">
                                    {idx + 1}
                                </span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 leading-relaxed truncate" title={sug.text}>
                                        {sug.text}
                                    </p>
                                </div>

                                {/* Type selector + confidence */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <ConfidenceDot confidence={sug.confidence} />
                                    <div className="relative">
                                        <select
                                            value={sug.suggestedType}
                                            onChange={(e) => onUpdateSuggestion(sug.id, e.target.value)}
                                            className={`appearance-none text-[11px] font-bold px-2 py-1 pr-6 rounded-md border cursor-pointer outline-none transition-colors ${colors.bg} ${colors.text} ${colors.border}`}
                                        >
                                            {ALL_TYPES.map(type => (
                                                <option key={type} value={type}>
                                                    {labels[type] || type}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${colors.text}`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer hint */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center gap-2">
                <AlertCircle size={12} className="text-slate-400" />
                <p className="text-[10px] text-slate-400">
                    {i18n.hint || 'Change format type via dropdown, then click Accept All to apply.'}
                    <span className="ml-2 inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span> {i18n.high || 'High'}
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1"></span> {i18n.medium || 'Medium'}
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-400 ml-1"></span> {i18n.low || 'Low'}
                    </span>
                </p>
            </div>
        </div>
    );
}
