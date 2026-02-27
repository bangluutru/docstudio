import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ClipboardPaste,
    PlusCircle,
    Printer,
    Languages,
    AlertTriangle,
    Trash2,
    FileText,
    HardDrive,
    CheckCircle2,
    Scale,
    Edit3,
    Eye,
} from 'lucide-react';

// =====================================================================
// Helper: Single Source of Truth for language resolution
// =====================================================================
const getLangVal = (obj, baseKey, lang, defaultVal = '') => {
    if (!obj) return defaultVal;
    if (obj[`${baseKey}_${lang}`] !== undefined) return obj[`${baseKey}_${lang}`];
    if (obj[`${baseKey}_vn`] !== undefined) return obj[`${baseKey}_vn`];
    if (obj[baseKey] !== undefined) return obj[baseKey];
    return defaultVal;
};

// =====================================================================
// Helper: Strip Gemini citation markers like [cite: 1], [cite: 1, 2]
// =====================================================================
const stripCitations = (text) => {
    if (typeof text !== 'string') return text;
    return text.replace(/\s*\[cite:\s*[\d,\s]+\]/gi, '').trim();
};

// =====================================================================
// UI Translations for the Legal Document module
// =====================================================================
const legalUiTranslations = {
    vn: {
        pasteLabel: 'Nhập Dữ Liệu JSON',
        appendBtn: 'Tải văn bản',
        clearBtn: 'Xóa văn bản',
        confirmClear: 'Bạn có chắc chắn muốn xóa văn bản hiện tại không?',
        printBtn: 'Xuất PDF / In',
        placeholder: '{ "type": "legal_doc", "title_vn": "...", "content_vn": "..." }',
        empty: 'Vui lòng dán dữ liệu JSON vào cột trái để bắt đầu',
        errorPrefix: 'Lỗi phân tích dữ liệu: ',
        errorInvalid: 'JSON không hợp lệ hoặc thiếu trường bắt buộc (type, content_vn).',
        saving: 'Đang lưu...',
        saved: 'Đã lưu',
        docLoaded: 'Đã tải văn bản',
        noContent: 'Không có nội dung để hiển thị.',
        editBtn: 'Chỉnh sửa',
        previewBtn: 'Xem thử',
    },
    en: {
        pasteLabel: 'Input JSON Data',
        appendBtn: 'Load Document',
        clearBtn: 'Clear Document',
        confirmClear: 'Are you sure you want to clear the current document?',
        printBtn: 'Export PDF / Print',
        placeholder: '{ "type": "legal_doc", "title_en": "...", "content_en": "..." }',
        empty: 'Please paste JSON data in the left column to start',
        errorPrefix: 'Parse error: ',
        errorInvalid: 'Invalid JSON or missing required fields (type, content_vn).',
        saving: 'Saving...',
        saved: 'Saved',
        docLoaded: 'Document loaded',
        noContent: 'No content to display.',
        editBtn: 'Edit',
        previewBtn: 'Preview',
    },
    jp: {
        pasteLabel: 'JSONデータ入力',
        appendBtn: '文書を読み込む',
        clearBtn: '文書を削除',
        confirmClear: '現在の文書を削除しますか？',
        printBtn: 'PDFに書き出す / 印刷',
        placeholder: '{ "type": "legal_doc", "title_jp": "...", "content_jp": "..." }',
        empty: '左の列にJSONデータを貼り付けてください',
        errorPrefix: '解析エラー: ',
        errorInvalid: '無効なJSONまたは必須フィールド(type, content_vn)が不足しています。',
        saving: '保存中...',
        saved: '保存済み',
        docLoaded: '文書を読み込みました',
        noContent: '表示するコンテンツがありません。',
        editBtn: '編集',
        previewBtn: 'プレビュー',
    },
};

const LEGAL_STORAGE_KEY = 'docstudio_legal_doc_v1';

// =====================================================================
// LegalDocumentView — Full module for legal document translation
// =====================================================================
const LegalDocumentView = ({ displayLang, onLangChange }) => {
    const [jsonInput, setJsonInput] = useState('');
    const [docData, setDocData] = useState(() => {
        try {
            const stored = localStorage.getItem(LEGAL_STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });
    const [error, setError] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const printRef = useRef(null);

    const t = legalUiTranslations[displayLang] || legalUiTranslations.vn;

    // --- Persist to localStorage ---
    const saveDoc = (data) => {
        setSaveStatus('saving');
        try {
            localStorage.setItem(LEGAL_STORAGE_KEY, JSON.stringify(data));
            setTimeout(() => setSaveStatus('saved'), 300);
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (e) {
            console.error('Save error', e);
        }
    };

    // --- Load JSON ---
    const handleLoadData = () => {
        setError('');
        try {
            const raw = jsonInput.trim();
            if (!raw) return;
            const parsed = JSON.parse(raw);
            // Validate: must have type and at least content_vn
            if (!parsed || !parsed.content_vn) {
                setError(t.errorInvalid);
                return;
            }
            setDocData(parsed);
            saveDoc(parsed);
        } catch (e) {
            setError(t.errorPrefix + e.message);
        }
    };

    // --- Clear ---
    const clearDoc = () => {
        if (!window.confirm(t.confirmClear)) return;
        setDocData(null);
        setJsonInput('');
        localStorage.removeItem(LEGAL_STORAGE_KEY);
    };

    // --- Print ---
    const handlePrint = () => {
        setTimeout(() => {
            try { window.print(); } catch (e) { console.error('Print Error:', e); }
        }, 400);
    };

    // --- Edit handler: update docData field directly ---
    const handleEditField = (field, value) => {
        if (!docData) return;
        const updated = { ...docData, [field]: value };
        setDocData(updated);
        saveDoc(updated);
    };

    // --- Edit handler: update nested meta_info field ---
    const handleEditMeta = (field, value) => {
        if (!docData || !docData.meta_info) return;
        const updated = { ...docData, meta_info: { ...docData.meta_info, [field]: value } };
        setDocData(updated);
        saveDoc(updated);
    };

    // --- Resolve data (with citation stripping) ---
    const title = docData ? stripCitations(getLangVal(docData, 'title', displayLang)) : '';
    const content = docData ? stripCitations(getLangVal(docData, 'content', displayLang)) : '';
    const metaInfo = docData?.meta_info || null;

    return (
        <>
            {/* Print styles specific to legal doc */}
            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .legal-doc-print {
            width: 210mm !important;
            margin: 0 !important;
            padding: 20mm 25mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .legal-doc-print h1, .legal-doc-print h2, .legal-doc-print h3 {
            page-break-after: avoid;
          }
          .legal-doc-print p, .legal-doc-print li, .legal-doc-print tr {
            page-break-inside: avoid;
          }
          .legal-doc-print table {
            page-break-inside: auto;
          }
          main {
            padding: 0 !important;
            background: white !important;
          }
        }
        .legal-prose h1 { font-size: 1.4em; font-weight: 800; margin: 1.2em 0 0.5em; text-align: center; text-transform: uppercase; }
        .legal-prose h2 { font-size: 1.15em; font-weight: 700; margin: 1.1em 0 0.4em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
        .legal-prose h3 { font-size: 1.05em; font-weight: 700; margin: 0.9em 0 0.3em; }
        .legal-prose p { margin: 0.5em 0; line-height: 1.85; text-align: justify; }
        .legal-prose ul, .legal-prose ol { padding-left: 1.8em; margin: 0.4em 0; }
        .legal-prose li { margin: 0.25em 0; line-height: 1.7; }
        .legal-prose strong { font-weight: 700; }
        .legal-prose em { font-style: italic; }
        .legal-prose blockquote { border-left: 3px solid #6366f1; padding-left: 1em; margin: 0.5em 0; color: #475569; font-style: italic; }
        .legal-prose table { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
        .legal-prose th, .legal-prose td { border: 1px solid #334155; padding: 6px 10px; text-align: left; font-size: 0.92em; }
        .legal-prose th { background: #f1f5f9; font-weight: 700; }
        .legal-prose hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.2em 0; }
      `}</style>

            <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-900">
                {/* ============================================================
            LEFT PANEL — LEGAL
        ============================================================ */}
                <aside className="no-print w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col shadow-sm z-[60]">
                    {/* Brand */}
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-emerald-600 to-emerald-800 shrink-0">
                        <div className="flex items-center gap-2.5 text-white mb-1">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                                <Scale size={18} strokeWidth={2.5} className="text-white" />
                            </div>
                            <h1 className="text-xl font-black tracking-tight uppercase italic">DocStudio</h1>
                        </div>
                        <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-widest mt-0.5">
                            Legal Document Translator
                        </p>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {/* JSON Input */}
                        <section>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wide">
                                    <ClipboardPaste size={13} /> {t.pasteLabel}
                                </label>
                                <div className="text-[10px] font-semibold">
                                    {saveStatus === 'saving' && (
                                        <span className="animate-pulse flex items-center gap-1 text-amber-500">
                                            <HardDrive size={10} /> {t.saving}
                                        </span>
                                    )}
                                    {saveStatus === 'saved' && (
                                        <span className="flex items-center gap-1 text-emerald-500">
                                            <CheckCircle2 size={10} /> {t.saved}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder={t.placeholder}
                                className="w-full h-36 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-xs mb-2.5 outline-none transition-all resize-none shadow-inner text-slate-700"
                            />

                            <button
                                onClick={handleLoadData}
                                disabled={!jsonInput.trim()}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-sm"
                            >
                                <PlusCircle size={15} /> {t.appendBtn}
                            </button>

                            {error && (
                                <div className="mt-2.5 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 items-start">
                                    <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-red-600 font-medium leading-relaxed">{error}</p>
                                </div>
                            )}
                        </section>

                        {/* Doc Status */}
                        {docData && (
                            <section className="pt-3 border-t border-slate-100">
                                <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 flex justify-between items-center">
                                    <span className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> {t.docLoaded}
                                    </span>
                                </div>
                            </section>
                        )}

                        {/* Clear */}
                        {docData && (
                            <div className="pt-3 border-t border-slate-100">
                                <button
                                    onClick={clearDoc}
                                    className="w-full py-2.5 border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                                >
                                    <Trash2 size={12} /> {t.clearBtn}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <HardDrive size={10} />
                            <span>Lưu tại <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-500">localStorage</code></span>
                        </div>
                    </div>
                </aside>

                {/* ============================================================
            RIGHT PANEL — PREVIEW
        ============================================================ */}
                <main className="flex-grow bg-slate-200 min-h-screen relative p-4 md:p-8 flex flex-col items-center">

                    {/* Floating Toolbar */}
                    <div className="no-print w-full max-w-[210mm] mb-6 flex flex-wrap justify-between items-center gap-3 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/80 sticky top-4 z-[50]">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                                <Languages size={15} className="text-slate-400" />
                                <select
                                    value={displayLang}
                                    onChange={(e) => onLangChange(e.target.value)}
                                    className="bg-transparent border-none focus:ring-0 text-sm font-bold outline-none text-slate-700 cursor-pointer"
                                >
                                    <option value="vn">Tiếng Việt</option>
                                    <option value="en">English</option>
                                    <option value="jp">日本語</option>
                                </select>
                            </div>

                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                disabled={!docData}
                                className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-xl transition-all text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isEditing
                                    ? 'bg-amber-500 text-white shadow-amber-200'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {isEditing ? <><Eye size={14} /> {t.previewBtn}</> : <><Edit3 size={14} /> {t.editBtn}</>}
                            </button>
                        </div>

                        <button
                            onClick={() => { setIsEditing(false); handlePrint(); }}
                            disabled={!docData}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            <Printer size={15} /> {t.printBtn}
                        </button>
                    </div>

                    {/* Document Canvas */}
                    {!docData ? (
                        <div className="w-[210mm] min-h-[297mm] bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-300 gap-5">
                            <Scale size={72} strokeWidth={1} />
                            <p className="text-lg font-bold">{t.empty}</p>
                        </div>
                    ) : (
                        <div
                            ref={printRef}
                            className="legal-doc-print w-[210mm] bg-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] border border-slate-100 rounded-sm"
                            style={{ fontFamily: "'Times New Roman', Times, serif", padding: '20mm 25mm' }}
                        >
                            {/* Meta Header */}
                            {metaInfo && (
                                <div className="text-center mb-6 font-sans">
                                    {isEditing ? (
                                        <input
                                            className="w-full text-center font-bold text-[11pt] uppercase tracking-wider bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-1 text-slate-700 rounded"
                                            value={getLangVal(metaInfo, 'issuer', displayLang)}
                                            onChange={(e) => handleEditMeta(`issuer_${displayLang}`, e.target.value)}
                                        />
                                    ) : (
                                        <p className="text-[11pt] font-bold uppercase tracking-wider text-slate-600">
                                            {stripCitations(getLangVal(metaInfo, 'issuer', displayLang))}
                                        </p>
                                    )}
                                    {metaInfo.doc_number && (
                                        isEditing ? (
                                            <input
                                                className="w-full text-center text-[10pt] bg-amber-50 border-b border-amber-300 focus:outline-none p-1 mt-1 text-slate-500 rounded"
                                                value={metaInfo.doc_number}
                                                onChange={(e) => handleEditMeta('doc_number', e.target.value)}
                                            />
                                        ) : (
                                            <p className="text-[10pt] text-slate-500 mt-1">{stripCitations(metaInfo.doc_number)}</p>
                                        )
                                    )}
                                    {(metaInfo.date_vn || metaInfo.date) && (
                                        isEditing ? (
                                            <input
                                                className="w-full text-center text-[10pt] italic bg-amber-50 border-b border-amber-300 focus:outline-none p-1 mt-0.5 text-slate-400 rounded"
                                                value={getLangVal(metaInfo, 'date', displayLang)}
                                                onChange={(e) => handleEditMeta(`date_${displayLang}`, e.target.value)}
                                            />
                                        ) : (
                                            <p className="text-[10pt] italic text-slate-400 mt-0.5">
                                                {stripCitations(getLangVal(metaInfo, 'date', displayLang))}
                                            </p>
                                        )
                                    )}
                                </div>
                            )}

                            {/* Title */}
                            {(title || isEditing) && (
                                <div className="text-center mb-8">
                                    {isEditing ? (
                                        <textarea
                                            className="w-full text-center font-bold text-[16pt] uppercase bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-2 resize-none rounded leading-tight"
                                            value={getLangVal(docData, 'title', displayLang)}
                                            rows={3}
                                            onChange={(e) => handleEditField(`title_${displayLang}`, e.target.value)}
                                        />
                                    ) : (
                                        <h1 className="font-bold text-[16pt] uppercase leading-tight whitespace-pre-line">
                                            {title}
                                        </h1>
                                    )}
                                </div>
                            )}

                            {/* Markdown Content */}
                            {isEditing ? (
                                <textarea
                                    className="w-full min-h-[500px] p-4 bg-amber-50/60 border border-amber-200 rounded-lg font-mono text-[10pt] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-800"
                                    value={getLangVal(docData, 'content', displayLang)}
                                    onChange={(e) => handleEditField(`content_${displayLang}`, e.target.value)}
                                    placeholder="Markdown content..."
                                />
                            ) : content ? (
                                <div className="legal-prose text-[11.5pt]">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 italic py-12">{t.noContent}</p>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default LegalDocumentView;
