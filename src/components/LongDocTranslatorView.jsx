import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
    Globe,
    Type,
    Landmark,
    GraduationCap,
    RotateCcw,
    FileDown,
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ExternalHyperlink, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { ZoomIn, ZoomOut } from 'lucide-react';
import PromptHelper from './PromptHelper';
import { LONG_DOC_TRANS_PROMPT, LONG_DOC_NOTEBOOKLM_PROMPT } from '../utils/prompts';

// =====================================================================
// UI Translations for the EJV Translator module
// =====================================================================
const ejvUiText = {
    vn: {
        pasteLabel: 'Nhập JSON từ Gemini',
        appendBtn: 'Nối văn bản',
        clearBtn: 'Xóa toàn bộ',
        confirmClear: 'Bạn có chắc chắn muốn xóa toàn bộ văn bản đã dịch không?',
        printBtn: 'Xuất PDF / In',
        exportDocx: 'Xuất DOCX',
        promptGemini: 'Gemini',
        promptNotebook: 'NotebookLM',
        saving: 'Đang lưu...',
        saved: 'Đã lưu',
        errorPrefix: 'Lỗi phân tích JSON: ',
        errorNoArray: 'Không tìm thấy cấu trúc mảng [ { ... } ] hợp lệ.',
        errorNotArray: 'Dữ liệu phải là một mảng (Array).',
        placeholder: '[ { "type": "h1", "vn": "...", "en": "...", "ja": "..." } ]',
        total: 'Tổng cộng',
        totalUnit: 'khối',
        empty: 'Paste JSON từ Gemini — mỗi batch nối tiếp vào văn bản',
        formatLabel: 'Định dạng',
        formatDefault: 'Mặc định',
        formatAdmin: 'Hành chính',
        formatAcademic: 'Học thuật',
        promptTitle: 'System Prompt cho Gemini',
        promptDesc: 'Copy prompt này gửi cho Gemini kèm tài liệu cần dịch:',
        viewJsonSample: 'Xem cấu trúc JSON mẫu',
        batchHint: 'Gemini sẽ trả về từng batch JSON. Paste mỗi batch và ấn "Nối văn bản".',
    },
    en: {
        pasteLabel: 'Input JSON from Gemini',
        appendBtn: 'Append Text',
        clearBtn: 'Clear All',
        confirmClear: 'Are you sure you want to clear all translated text?',
        printBtn: 'Export PDF / Print',
        exportDocx: 'Export DOCX',
        promptGemini: 'Gemini',
        promptNotebook: 'NotebookLM',
        saving: 'Saving...',
        saved: 'Saved',
        errorPrefix: 'JSON parse error: ',
        errorNoArray: 'No valid array structure [ { ... } ] found.',
        errorNotArray: 'Data must be an Array.',
        placeholder: '[ { "type": "h1", "vn": "...", "en": "...", "ja": "..." } ]',
        total: 'Total',
        totalUnit: 'blocks',
        empty: 'Paste JSON from Gemini — each batch appends to the document',
        formatLabel: 'Format',
        formatDefault: 'Default',
        formatAdmin: 'Administrative',
        formatAcademic: 'Academic',
        promptTitle: 'System Prompt for Gemini',
        promptDesc: 'Copy this prompt and send to Gemini along with your document:',
        viewJsonSample: 'View sample JSON structure',
        batchHint: 'Gemini returns JSON in batches. Paste each batch and click "Append Text".',
    },
    jp: {
        pasteLabel: 'GeminiからのJSON入力',
        appendBtn: 'テキストを追加',
        clearBtn: '全て削除',
        confirmClear: '翻訳されたテキストをすべて削除しますか？',
        printBtn: 'PDFに書き出す / 印刷',
        exportDocx: 'DOCX出力',
        promptGemini: 'Gemini',
        promptNotebook: 'NotebookLM',
        saving: '保存中...',
        saved: '保存済み',
        errorPrefix: 'JSON解析エラー: ',
        errorNoArray: '有効な配列構造 [ { ... } ] が見つかりません。',
        errorNotArray: 'データは配列でなければなりません。',
        placeholder: '[ { "type": "h1", "vn": "...", "en": "...", "ja": "..." } ]',
        total: '合計',
        totalUnit: 'ブロック',
        empty: 'GeminiからJSONを貼り付け — バッチごとにドキュメントに追加',
        formatLabel: 'フォーマット',
        formatDefault: 'デフォルト',
        formatAdmin: '行政文書',
        formatAcademic: '学術論文',
        promptTitle: 'Gemini用システムプロンプト',
        promptDesc: 'このプロンプトをコピーして翻訳したい文書と一緒にGeminiに送信：',
        viewJsonSample: 'サンプルJSON構造を表示',
        batchHint: 'Geminiはバッチ単位でJSONを返します。各バッチを貼り付けて「テキストを追加」をクリック。',
    },
};

const STORAGE_KEY = 'docstudio_ejv_blocks_v1';

// =====================================================================
// Format style definitions
// =====================================================================
const FORMAT_STYLES = {
    standard: {
        fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
        fontSize: '11pt',
        lineHeight: '1.6',
        textAlign: 'left',
        h1Size: '18pt',
        h2Size: '15pt',
        h3Size: '13pt',
    },
    administrative: {
        fontFamily: "'Times New Roman', 'Noto Serif JP', serif",
        fontSize: '13pt',
        lineHeight: '1.5',
        textAlign: 'justify',
        h1Size: '16pt',
        h2Size: '14pt',
        h3Size: '13pt',
    },
    academic: {
        fontFamily: "'Arial', 'Noto Sans JP', sans-serif",
        fontSize: '11pt',
        lineHeight: '1.15',
        textAlign: 'left',
        h1Size: '14pt',
        h2Size: '12pt',
        h3Size: '11pt',
    },
};

// =====================================================================
// Block renderer
// =====================================================================
const BlockRenderer = ({ block, lang, style }) => {
    const fs = FORMAT_STYLES[style];
    const val = block[lang] || block.vn || block.en || block.ja || '';

    const baseStyle = {
        fontFamily: fs.fontFamily,
        fontSize: fs.fontSize,
        lineHeight: fs.lineHeight,
        textAlign: fs.textAlign,
    };

    switch (block.type) {
        case 'h1':
            return (
                <h1
                    style={{
                        ...baseStyle,
                        fontSize: fs.h1Size,
                        fontWeight: 'bold',
                        margin: '24pt 0 12pt 0',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                    }}
                >
                    {val}
                </h1>
            );
        case 'h2':
            return (
                <h2
                    style={{
                        ...baseStyle,
                        fontSize: fs.h2Size,
                        fontWeight: 'bold',
                        margin: '18pt 0 8pt 0',
                    }}
                >
                    {val}
                </h2>
            );
        case 'h3':
            return (
                <h3
                    style={{
                        ...baseStyle,
                        fontSize: fs.h3Size,
                        fontWeight: 'bold',
                        margin: '12pt 0 6pt 0',
                    }}
                >
                    {val}
                </h3>
            );
        case 'p':
            return (
                <p
                    style={{
                        ...baseStyle,
                        margin: '0 0 8pt 0',
                        textIndent: style === 'administrative' ? '28pt' : '0',
                    }}
                >
                    {val}
                </p>
            );
        case 'ul': {
            const items = Array.isArray(val) ? val : [val];
            return (
                <ul style={{ ...baseStyle, margin: '4pt 0 8pt 20pt', listStyleType: 'disc' }}>
                    {items.map((item, i) => (
                        <li key={i} style={{ marginBottom: '2pt' }}>{item}</li>
                    ))}
                </ul>
            );
        }
        case 'ol': {
            const items = Array.isArray(val) ? val : [val];
            return (
                <ol style={{ ...baseStyle, margin: '4pt 0 8pt 20pt', listStyleType: 'decimal' }}>
                    {items.map((item, i) => (
                        <li key={i} style={{ marginBottom: '2pt' }}>{item}</li>
                    ))}
                </ol>
            );
        }
        case 'table': {
            const headers = block.headers?.[lang] || block.headers?.vn || [];
            const rows = block.rows?.[lang] || block.rows?.vn || [];
            return (
                <table
                    style={{
                        ...baseStyle,
                        width: '100%',
                        borderCollapse: 'collapse',
                        margin: '8pt 0',
                    }}
                >
                    {headers.length > 0 && (
                        <thead>
                            <tr>
                                {headers.map((h, i) => (
                                    <th
                                        key={i}
                                        style={{
                                            border: '1px solid #333',
                                            padding: '4pt 6pt',
                                            fontWeight: 'bold',
                                            backgroundColor: '#f0f0f0',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri}>
                                {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                                    <td
                                        key={ci}
                                        style={{
                                            border: '1px solid #333',
                                            padding: '3pt 6pt',
                                        }}
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        case 'blockquote':
            return (
                <blockquote
                    style={{
                        ...baseStyle,
                        margin: '8pt 0',
                        padding: '8pt 12pt',
                        borderLeft: '3pt solid #6366f1',
                        backgroundColor: '#f8f9ff',
                        fontStyle: 'italic',
                        color: '#475569',
                    }}
                >
                    {val}
                </blockquote>
            );
        case 'hr':
            return <hr style={{ margin: '16pt 0', border: 'none', borderTop: '1px solid #cbd5e1' }} />;
        case 'caption':
            return (
                <p
                    style={{
                        ...baseStyle,
                        fontSize: '9pt',
                        textAlign: 'center',
                        color: '#64748b',
                        fontStyle: 'italic',
                        margin: '4pt 0 12pt 0',
                    }}
                >
                    {val}
                </p>
            );
        default:
            return <p style={baseStyle}>{val}</p>;
    }
};


// =====================================================================
// LongDocTranslatorView — Main component
// =====================================================================
const LongDocTranslatorView = ({ displayLang: globalDisplayLang }) => {
    // --- State ---
    const [blocks, setBlocks] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    const [jsonInput, setJsonInput] = useState('');
    const [error, setError] = useState('');
    const [displayLang, setDisplayLang] = useState(globalDisplayLang || 'vn');
    const [formatStyle, setFormatStyle] = useState('standard');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [promptSource, setPromptSource] = useState('gemini');
    const [zoomLevel, setZoomLevel] = useState(100);
    const printRef = useRef(null);

    const t = ejvUiText[displayLang] || ejvUiText.vn;

    // --- Save to localStorage ---
    const saveBlocks = useCallback((newBlocks) => {
        setBlocks(newBlocks);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newBlocks));
        } catch (e) {
            console.error('localStorage save error:', e);
        }
        setSaveStatus('saving');
        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 1500);
        }, 300);
    }, []);

    // --- Append JSON batch ---
    const handleAppend = () => {
        try {
            setError('');
            let cleaned = jsonInput
                .replace(/\[cite[\s\S]*?\]/gi, '')
                .replace(/\[source[\s\S]*?\]/gi, '')
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/\[CÒN TIẾP[\s\S]*?\]/gi, '')
                .replace(/\[HOÀN TẤT[\s\S]*?\]/gi, '')
                .trim();

            const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (!match) throw new Error(t.errorNoArray);
            cleaned = match[0];

            const newData = JSON.parse(cleaned);
            if (!Array.isArray(newData)) throw new Error(t.errorNotArray);

            saveBlocks([...blocks, ...newData]);
            setJsonInput('');
        } catch (err) {
            setError(t.errorPrefix + err.message);
        }
    };

    // --- Clear all ---
    const handleClear = () => {
        if (window.confirm(t.confirmClear)) {
            saveBlocks([]);
        }
    };

    // --- Print ---
    const handlePrint = () => {
        setTimeout(() => {
            try { window.print(); } catch (e) { console.error('Print Error:', e); }
        }, 400);
    };

    // --- Export DOCX ---
    const handleExportDocx = async () => {
        const fs = FORMAT_STYLES[formatStyle];
        const children = [];

        for (const block of blocks) {
            const val = block[displayLang] || block.vn || block.en || block.ja || '';

            switch (block.type) {
                case 'h1':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, bold: true, size: parseInt(fs.h1Size) * 2, font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 480, after: 240 },
                    }));
                    break;
                case 'h2':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, bold: true, size: parseInt(fs.h2Size) * 2, font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 360, after: 160 },
                    }));
                    break;
                case 'h3':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, bold: true, size: parseInt(fs.h3Size) * 2, font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 240, after: 120 },
                    }));
                    break;
                case 'p':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, size: parseInt(fs.fontSize) * 2, font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                        spacing: { after: 160 },
                        alignment: formatStyle === 'administrative' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
                        indent: formatStyle === 'administrative' ? { firstLine: convertInchesToTwip(0.4) } : undefined,
                    }));
                    break;
                case 'ul':
                case 'ol': {
                    const items = Array.isArray(val) ? val : [val];
                    items.forEach(item => {
                        children.push(new Paragraph({
                            children: [new TextRun({ text: item, size: parseInt(fs.fontSize) * 2, font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                            bullet: block.type === 'ul' ? { level: 0 } : undefined,
                            numbering: block.type === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
                            spacing: { after: 40 },
                        }));
                    });
                    break;
                }
                case 'table': {
                    const headers = block.headers?.[displayLang] || block.headers?.vn || [];
                    const rows = block.rows?.[displayLang] || block.rows?.vn || [];
                    const tableRows = [];
                    if (headers.length > 0) {
                        tableRows.push(new TableRow({
                            children: headers.map(h => new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: parseInt(fs.fontSize) * 2 })] })],
                                width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
                            })),
                        }));
                    }
                    rows.forEach(row => {
                        const cells = Array.isArray(row) ? row : [row];
                        tableRows.push(new TableRow({
                            children: cells.map(cell => new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: parseInt(fs.fontSize) * 2 })] })],
                            })),
                        }));
                    });
                    if (tableRows.length > 0) {
                        children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
                        children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
                    }
                    break;
                }
                case 'blockquote':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, italics: true, size: parseInt(fs.fontSize) * 2, color: '475569', font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                        indent: { left: convertInchesToTwip(0.5) },
                        border: { left: { style: BorderStyle.SINGLE, size: 6, color: '6366f1' } },
                        spacing: { before: 160, after: 160 },
                    }));
                    break;
                case 'hr':
                    children.push(new Paragraph({
                        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' } },
                        spacing: { before: 320, after: 320 },
                    }));
                    break;
                case 'caption':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, italics: true, size: 18, color: '64748b', font: fs.fontFamily.split(',')[0].replace(/'/g, '').trim() })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80, after: 240 },
                    }));
                    break;
                default:
                    children.push(new Paragraph({
                        children: [new TextRun({ text: val, size: parseInt(fs.fontSize) * 2 })],
                        spacing: { after: 160 },
                    }));
            }
        }

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(0.79), right: convertInchesToTwip(0.59) },
                    },
                },
                children,
            }],
            numbering: {
                config: [{
                    reference: 'default-numbering',
                    levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
                }],
            },
        });

        const blob = await Packer.toBlob(doc);
        const langLabel = displayLang === 'ja' ? 'JP' : displayLang.toUpperCase();
        saveAs(blob, `EJV_Document_${langLabel}.docx`);
    };

    // --- Language button style helper ---
    const langBtnClass = (lang) =>
        `px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${displayLang === lang
            ? 'bg-teal-600 text-white shadow-md'
            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
        }`;

    // --- Format button style helper ---
    const fmtBtnClass = (fmt) =>
        `flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${formatStyle === fmt
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
        }`;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
            {/* ================= LEFT PANEL ================= */}
            <aside className="no-print w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col shadow-sm z-[60]">

                {/* Brand Header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-teal-600 to-teal-800 shrink-0">
                    <div className="flex items-center gap-2.5 text-white mb-1">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                            <Globe size={18} strokeWidth={2.5} className="text-white" />
                        </div>
                        <h1 className="text-xl font-black tracking-tight uppercase italic">EJV Translator</h1>
                    </div>
                    <p className="text-[10px] text-teal-200 font-bold uppercase tracking-widest mt-0.5">
                        Long Document Translation
                    </p>
                </div>

                {/* Scrollable Body */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">

                    {/* Prompt Source Toggle */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => setPromptSource('gemini')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${promptSource === 'gemini' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            ✨ {t.promptGemini}
                        </button>
                        <button
                            onClick={() => setPromptSource('notebooklm')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${promptSource === 'notebooklm' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            📓 {t.promptNotebook}
                        </button>
                    </div>

                    {/* Prompt Helper */}
                    <PromptHelper
                        title={promptSource === 'gemini' ? t.promptTitle : `${t.promptTitle} (NotebookLM)`}
                        promptText={promptSource === 'gemini' ? LONG_DOC_TRANS_PROMPT : LONG_DOC_NOTEBOOKLM_PROMPT}
                        description={t.promptDesc}
                    />

                    {/* Batch hint */}
                    <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl">
                        <p className="text-[11px] text-teal-700 font-medium leading-relaxed">
                            💡 {t.batchHint}
                        </p>
                    </div>

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
                            className="w-full h-36 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-xs mb-2.5 outline-none transition-all resize-none shadow-inner text-slate-700"
                        />

                        <button
                            onClick={handleAppend}
                            disabled={!jsonInput.trim()}
                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-sm"
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

                    {/* Block Count */}
                    <section className="pt-3 border-t border-slate-100">
                        <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-500">{t.total}:</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="font-black text-2xl text-slate-800">{blocks.length}</span>
                                <span className="text-xs text-slate-400">{t.totalUnit}</span>
                            </div>
                        </div>
                    </section>

                    {/* JSON Sample */}
                    {blocks.length === 0 && (
                        <section className="pt-1">
                            <details className="group">
                                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1.5 select-none transition-colors">
                                    <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                                    {t.viewJsonSample}
                                </summary>
                                <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed">
                                    {`[
  { "type": "h1", "vn": "TIÊU ĐỀ", "en": "TITLE", "ja": "タイトル" },
  { "type": "p",  "vn": "Đoạn văn...", "en": "Paragraph...", "ja": "段落..." },
  { "type": "ul", "vn": ["Mục 1"], "en": ["Item 1"], "ja": ["項目1"] },
  { "type": "table",
    "headers": { "vn": ["Cột"], "en": ["Col"], "ja": ["列"] },
    "rows":    { "vn": [["A"]], "en": [["A"]], "ja": [["A"]] }
  },
  { "type": "hr" }
]`}
                                </pre>
                            </details>
                        </section>
                    )}

                    {/* Clear All */}
                    {blocks.length > 0 && (
                        <div className="pt-3 border-t border-slate-100">
                            <button
                                onClick={handleClear}
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

            {/* ================= RIGHT PANEL — PREVIEW ================= */}
            <main className="flex-grow bg-slate-200 min-h-screen relative p-4 md:p-8 flex flex-col items-center">

                {/* Print styles */}
                <style>{`
                    @media print {
                        .no-print { display: none !important; }
                        body { background: white !important; margin: 0; padding: 0; }
                        main { padding: 0 !important; background: white !important; }
                        .ejv-page {
                            width: 210mm !important;
                            height: 297mm !important;
                            margin: 0 !important;
                            padding: 25mm 15mm 25mm 20mm !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            page-break-after: always;
                            page-break-inside: avoid;
                            overflow: hidden !important;
                            position: relative;
                        }
                        .ejv-page:last-child {
                            page-break-after: auto;
                        }
                        .ejv-page-number {
                            position: absolute;
                            bottom: 12mm;
                            right: 15mm;
                        }
                    }
                    @page {
                        size: A4;
                        margin: 0;
                    }
                `}</style>

                {/* Floating Toolbar */}
                <div className="no-print w-full max-w-[210mm] mb-6 flex flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-white/80 sticky top-[48px] z-[50]">

                    {/* Language Selector */}
                    <div className="flex items-center gap-1.5">
                        <Languages size={14} className="text-slate-400" />
                        <div className="flex gap-0.5">
                            <button onClick={() => setDisplayLang('vn')} className={langBtnClass('vn')}>VN</button>
                            <button onClick={() => setDisplayLang('en')} className={langBtnClass('en')}>EN</button>
                            <button onClick={() => setDisplayLang('ja')} className={langBtnClass('ja')}>JA</button>
                        </div>
                    </div>

                    {/* Format Buttons */}
                    <div className="flex items-center gap-1">
                        <Type size={13} className="text-slate-400" />
                        <button onClick={() => setFormatStyle('standard')} className={fmtBtnClass('standard')}>
                            <RotateCcw size={11} /> {t.formatDefault}
                        </button>
                        <button onClick={() => setFormatStyle('administrative')} className={fmtBtnClass('administrative')}>
                            <Landmark size={11} /> {t.formatAdmin}
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-0.5">
                        <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all" title="Zoom Out">
                            <ZoomOut size={13} />
                        </button>
                        <span className="text-[10px] font-bold text-slate-500 min-w-[30px] text-center">{zoomLevel}%</span>
                        <button onClick={() => setZoomLevel(z => Math.min(200, z + 10))} className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all" title="Zoom In">
                            <ZoomIn size={13} />
                        </button>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleExportDocx}
                            disabled={blocks.length === 0}
                            title={t.exportDocx}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        >
                            <FileDown size={14} /> DOCX
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={blocks.length === 0}
                            title={t.printBtn}
                            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white font-bold rounded-xl shadow-md hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        >
                            <Printer size={14} /> PDF
                        </button>
                    </div>
                </div>

                {/* Document Canvas */}
                <div id="print-area" ref={printRef} className="flex flex-col gap-8 pb-24 items-center w-full" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                    {blocks.length === 0 ? (
                        <div className="w-[210mm] min-h-[297mm] bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-300 gap-5">
                            <Globe size={72} strokeWidth={1} />
                            <p className="text-lg font-medium italic text-center px-8">{t.empty}</p>
                        </div>
                    ) : (
                        <PaginatedPages
                            blocks={blocks}
                            lang={displayLang}
                            formatStyle={formatStyle}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

// =====================================================================
// PaginatedPages — Renders blocks across A4 pages with page numbers
// Uses a hidden measurement container to calculate actual heights
// =====================================================================
const PAGE_CONTENT_HEIGHT_MM = 247; // 297mm - 25mm top - 25mm bottom
const PX_PER_MM = 3.7795; // 1mm ≈ 3.7795px at 96dpi
const SAFETY_BUFFER_MM = 5; // Safety buffer to prevent text clipping at page edges
const PAGE_CONTENT_HEIGHT_PX = (PAGE_CONTENT_HEIGHT_MM - SAFETY_BUFFER_MM) * PX_PER_MM;

const PaginatedPages = ({ blocks, lang, formatStyle }) => {
    const [pages, setPages] = useState([]);
    const measureRef = useRef(null);

    useEffect(() => {
        // Use rAF to ensure DOM is ready for measurements
        const frame = requestAnimationFrame(() => {
            if (!measureRef.current) return;

            const container = measureRef.current;
            const children = container.children;
            if (children.length === 0) {
                setPages([]);
                return;
            }

            const newPages = [];
            let currentPage = [];
            let currentHeight = 0;

            for (let i = 0; i < children.length; i++) {
                const childHeight = children[i].getBoundingClientRect().height;

                // If adding this block would exceed page height, start a new page
                if (currentHeight + childHeight > PAGE_CONTENT_HEIGHT_PX && currentPage.length > 0) {
                    newPages.push({ indices: [...currentPage], oversized: false });
                    currentPage = [];
                    currentHeight = 0;
                }

                // If single block is taller than a page, mark it as oversized
                if (childHeight > PAGE_CONTENT_HEIGHT_PX && currentPage.length === 0) {
                    currentPage.push(i);
                    newPages.push({ indices: [...currentPage], oversized: true });
                    currentPage = [];
                    currentHeight = 0;
                    continue;
                }

                currentPage.push(i);
                currentHeight += childHeight;
            }

            // Add remaining blocks as last page
            if (currentPage.length > 0) {
                newPages.push({ indices: [...currentPage], oversized: false });
            }

            setPages(newPages);
        });

        return () => cancelAnimationFrame(frame);
    }, [blocks, lang, formatStyle]);

    const totalPages = pages.length || 1;

    return (
        <>
            {/* Hidden measurement container — renders all blocks to measure heights */}
            <div
                ref={measureRef}
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    visibility: 'hidden',
                    width: '175mm', // 210mm - 20mm left - 15mm right
                    left: '-9999px',
                    top: 0,
                    pointerEvents: 'none',
                }}
            >
                {blocks.map((block, idx) => (
                    <div key={idx}>
                        <BlockRenderer block={block} lang={lang} style={formatStyle} />
                    </div>
                ))}
            </div>

            {/* Actual paginated pages */}
            {pages.map((page, pageIdx) => (
                <div
                    key={pageIdx}
                    className="ejv-page w-[210mm] bg-white shadow-xl rounded-sm relative"
                    style={{
                        padding: '25mm 15mm 25mm 20mm',
                        minHeight: '297mm',
                        height: page.oversized ? 'auto' : '297mm',
                        boxSizing: 'border-box',
                        overflow: 'visible',
                    }}
                >
                    {/* Page content */}
                    <div style={{ minHeight: page.oversized ? undefined : `${PAGE_CONTENT_HEIGHT_MM}mm`, maxHeight: page.oversized ? undefined : `${PAGE_CONTENT_HEIGHT_MM}mm`, overflow: 'visible' }}>
                        {page.indices.map((blockIdx) => (
                            <BlockRenderer
                                key={blockIdx}
                                block={blocks[blockIdx]}
                                lang={lang}
                                style={formatStyle}
                            />
                        ))}
                    </div>

                    {/* Page number — bottom-right */}
                    <div
                        className="ejv-page-number"
                        style={{
                            position: 'absolute',
                            bottom: '12mm',
                            right: '15mm',
                            fontSize: '9pt',
                            color: '#94a3b8',
                            fontFamily: "'Inter', sans-serif",
                        }}
                    >
                        {pageIdx + 1} / {totalPages}
                    </div>
                </div>
            ))}
        </>
    );
};

export default LongDocTranslatorView;
