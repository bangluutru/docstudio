import { X, Plus } from 'lucide-react';

// P0-B: Content lines with add/delete in edit mode
const ContentLines = ({ lines, isEditing, pageIndex, displayLang, onEditChange, onAddLine, onDeleteLine, t }) => {
    if (!Array.isArray(lines)) return null;

    return (
        <>
            {lines.map((line, i) => {
                const isListItem = line.trim().startsWith('-') || /^\d+\./.test(line.trim());

                if (isEditing) {
                    return (
                        <div key={i} className="relative group/line">
                            <div className="flex items-start gap-1.5">
                                {/* Delete line button */}
                                <button
                                    onClick={() => onDeleteLine(pageIndex, `content_${displayLang}`, i)}
                                    className="shrink-0 mt-2 w-5 h-5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-red-300 hover:text-red-500 transition-all opacity-0 group-hover/line:opacity-100"
                                    title={t.deleteLineTitle}
                                >
                                    <X size={9} />
                                </button>

                                <textarea
                                    className={`flex-1 bg-amber-50/40 border-b border-amber-200 focus:bg-amber-50 focus:outline-none p-1.5 text-slate-800 resize-none font-serif text-[12pt] leading-relaxed rounded-sm transition-colors ${isListItem ? 'pl-6' : ''}`}
                                    value={line}
                                    rows={Math.max(1, Math.ceil(line.length / 75))}
                                    onChange={(e) => onEditChange(pageIndex, `content_${displayLang}`, e.target.value, i)}
                                />
                            </div>

                            {/* Add line below button — shows on hover */}
                            <button
                                onClick={() => onAddLine(pageIndex, `content_${displayLang}`, i)}
                                className="w-full mt-0.5 py-0.5 flex items-center gap-1 text-[9px] text-indigo-300 hover:text-indigo-600 font-semibold opacity-0 group-hover/line:opacity-100 transition-all justify-center hover:bg-indigo-50 rounded"
                                title={t.addLine}
                            >
                                <Plus size={9} /> {t.addLine}
                            </button>
                        </div>
                    );
                }

                return (
                    <p key={i} className={`${isListItem ? 'pl-8 -indent-8' : ''}`}>
                        {line}
                    </p>
                );
            })}

            {/* Add first line button when content is empty in edit mode */}
            {isEditing && lines.length === 0 && (
                <button
                    onClick={() => onAddLine(pageIndex, `content_${displayLang}`, -1)}
                    className="w-full py-3 flex items-center gap-2 justify-center text-sm text-indigo-400 hover:text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg transition-all"
                >
                    <Plus size={14} /> {t.addLine}
                </button>
            )}
        </>
    );
};

export default ContentLines;
