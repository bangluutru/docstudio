import { Languages, Edit3, Eye, ZoomIn, ZoomOut, FileDown, Printer } from 'lucide-react';
import GoogleFontPicker from './GoogleFontPicker';

// =====================================================================
// DocToolbar — Unified toolbar component for all DocStudio tabs
// Matches Tab 3 compact single-row layout (flex-nowrap, gap-2)
// =====================================================================
const DocToolbar = ({
    // Language
    displayLang = 'vn',
    onLangChange,
    langOptions = ['vn', 'en', 'ja'],      // default 3 langs
    // Accent color per tab
    accentColor = 'indigo',                 // indigo | teal | emerald | fuchsia
    // Edit toggle (optional)
    showEdit = false,
    isEditing = false,
    onToggleEdit,
    disableEdit = false,
    // Font picker (optional — Tab 3 only)
    showFontPicker = false,
    currentFont,
    onFontChange,
    // Zoom
    zoomLevel = 100,
    onZoomChange,
    // Export
    onExportDocx,
    onPrint,
    disableActions = false,
    // Labels
    printLabel = 'PDF',
}) => {

    // Accent color mapping
    const colorMap = {
        indigo: { active: 'bg-indigo-600', hover: 'hover:bg-indigo-700', print: 'bg-indigo-600 hover:bg-indigo-700' },
        teal: { active: 'bg-teal-600', hover: 'hover:bg-teal-700', print: 'bg-teal-600 hover:bg-teal-700' },
        emerald: { active: 'bg-emerald-600', hover: 'hover:bg-emerald-700', print: 'bg-emerald-600 hover:bg-emerald-700' },
        fuchsia: { active: 'bg-fuchsia-600', hover: 'hover:bg-fuchsia-700', print: 'bg-fuchsia-600 hover:bg-fuchsia-700' },
    };
    const c = colorMap[accentColor] || colorMap.indigo;

    const langBtnClass = (lang) =>
        `px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${displayLang === lang
            ? `${c.active} text-white shadow-md`
            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
        }`;

    // Map display labels
    const langLabels = { vn: 'VN', en: 'EN', ja: 'JA', jp: 'JA' };

    return (
        <div className="no-print w-full max-w-[210mm] mb-6 flex flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-white/80 sticky top-[48px] z-[50]">

            {/* Language Selector */}
            <div className="flex items-center gap-1.5 shrink-0">
                <Languages size={14} className="text-slate-400" />
                <div className="flex gap-0.5">
                    {langOptions.map(lang => (
                        <button
                            key={lang}
                            onClick={() => onLangChange?.(lang)}
                            className={langBtnClass(lang)}
                        >
                            {langLabels[lang] || lang.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Font Picker (optional) */}
            {showFontPicker && onFontChange && (
                <div className="shrink-0">
                    <GoogleFontPicker
                        currentFont={currentFont}
                        onFontChange={onFontChange}
                        accentColor={accentColor}
                    />
                </div>
            )}

            {/* Edit Toggle (optional) — icon-only for compact layout */}
            {showEdit && onToggleEdit && (
                <button
                    onClick={onToggleEdit}
                    disabled={disableEdit}
                    className={`p-1.5 rounded-lg transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${isEditing
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        }`}
                    title={isEditing ? 'Preview' : 'Edit'}
                >
                    {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
                </button>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-0.5 shrink-0">
                <button
                    onClick={() => onZoomChange?.(Math.max(50, zoomLevel - 10))}
                    className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all"
                    title="Zoom Out"
                >
                    <ZoomOut size={13} />
                </button>
                <span className="text-[10px] font-bold text-slate-500 min-w-[30px] text-center">
                    {zoomLevel}%
                </span>
                <button
                    onClick={() => onZoomChange?.(Math.min(200, zoomLevel + 10))}
                    className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all"
                    title="Zoom In"
                >
                    <ZoomIn size={13} />
                </button>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    onClick={onExportDocx}
                    disabled={disableActions}
                    title="Export DOCX"
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                    <FileDown size={14} /> DOCX
                </button>
                <button
                    onClick={onPrint}
                    disabled={disableActions}
                    title="Export PDF / Print"
                    className={`flex items-center gap-1.5 px-3 py-2 ${c.print} text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs`}
                >
                    <Printer size={14} /> {printLabel}
                </button>
            </div>
        </div>
    );
};

export default DocToolbar;
