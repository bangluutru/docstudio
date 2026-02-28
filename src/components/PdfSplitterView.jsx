import { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    Upload,
    Scissors,
    FileDown,
    Layers,
    Trash2,
    CheckSquare,
    Square,
    X,
} from 'lucide-react';

// Configure pdf.js worker using Vite ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// =====================================================================
// UI Translations
// =====================================================================
const uiText = {
    vn: {
        subtitle: 'TÁCH & GHÉP TRANG PDF',
        dropZone: 'Kéo thả file PDF vào đây',
        dropHint: 'hoặc click để chọn file',
        pages: 'trang',
        selected: 'đã chọn',
        selectAll: 'Chọn tất cả',
        deselectAll: 'Bỏ chọn',
        downloadIndividual: 'Tải riêng lẻ',
        downloadMerged: 'Ghép thành 1 file',
        processing: 'Đang xử lý PDF...',
        downloadPage: 'Tải trang',
        page: 'Trang',
    },
    en: {
        subtitle: 'PDF PAGE SPLITTER & MERGER',
        dropZone: 'Drag & drop PDF file here',
        dropHint: 'or click to choose file',
        pages: 'pages',
        selected: 'selected',
        selectAll: 'Select all',
        deselectAll: 'Deselect',
        downloadIndividual: 'Download individual',
        downloadMerged: 'Merge into 1 file',
        processing: 'Processing PDF...',
        downloadPage: 'Download page',
        page: 'Page',
    },
    jp: {
        subtitle: 'PDFページ分割・結合',
        dropZone: 'PDFファイルをここにドラッグ＆ドロップ',
        dropHint: 'またはクリックしてファイルを選択',
        pages: 'ページ',
        selected: '選択中',
        selectAll: 'すべて選択',
        deselectAll: '選択解除',
        downloadIndividual: '個別ダウンロード',
        downloadMerged: '1ファイルに結合',
        processing: 'PDF処理中...',
        downloadPage: 'ページをダウンロード',
        page: 'ページ',
    },
};

// =====================================================================
// PdfSplitterView — PDF Page Splitter & Merger
// =====================================================================
const PdfSplitterView = ({ displayLang = 'vn' }) => {
    const t = uiText[displayLang] || uiText.vn;
    const [pdfFile, setPdfFile] = useState(null);        // ArrayBuffer
    const [fileName, setFileName] = useState('');
    const [pageCount, setPageCount] = useState(0);
    const [thumbnails, setThumbnails] = useState([]);     // base64 data URLs
    const [selected, setSelected] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    // --- Generate thumbnails from PDF ---
    const generateThumbnails = useCallback(async (arrayBuffer) => {
        setIsLoading(true);
        try {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            const count = pdf.numPages;
            setPageCount(count);

            const thumbs = [];
            for (let i = 1; i <= count; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.4 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
                thumbs.push(canvas.toDataURL('image/jpeg', 0.7));
            }
            setThumbnails(thumbs);
            setSelected(new Set());
        } catch (e) {
            console.error('PDF parse error:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- File upload handler ---
    const handleFile = useCallback((file) => {
        if (!file || file.type !== 'application/pdf') return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target.result;
            setPdfFile(buffer);
            generateThumbnails(buffer);
        };
        reader.readAsArrayBuffer(file);
    }, [generateThumbnails]);

    // --- Drag & Drop ---
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    // --- Toggle page selection ---
    const togglePage = (index) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    };

    // --- Select/Deselect all ---
    const selectAll = () => {
        const allPages = new Set();
        for (let i = 0; i < pageCount; i++) allPages.add(i);
        setSelected(allPages);
    };
    const deselectAll = () => setSelected(new Set());

    // --- Download helper ---
    const downloadBlob = (bytes, name) => {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    // --- Extract single page as PDF ---
    const extractPage = async (pageIndex) => {
        if (!pdfFile) return;
        const srcDoc = await PDFDocument.load(pdfFile);
        const newDoc = await PDFDocument.create();
        const [copied] = await newDoc.copyPages(srcDoc, [pageIndex]);
        newDoc.addPage(copied);
        const bytes = await newDoc.save();
        const baseName = fileName.replace('.pdf', '');
        downloadBlob(bytes, `${baseName}_page${pageIndex + 1}.pdf`);
    };

    // --- Download selected pages as individual PDFs ---
    const downloadIndividual = async () => {
        if (!pdfFile || selected.size === 0) return;
        const sortedPages = [...selected].sort((a, b) => a - b);
        for (const pageIndex of sortedPages) {
            await extractPage(pageIndex);
            // Small delay between downloads
            await new Promise(r => setTimeout(r, 300));
        }
    };

    // --- Merge selected pages into one PDF ---
    const downloadMerged = async () => {
        if (!pdfFile || selected.size === 0) return;
        const srcDoc = await PDFDocument.load(pdfFile);
        const newDoc = await PDFDocument.create();
        const sortedPages = [...selected].sort((a, b) => a - b);
        const copiedPages = await newDoc.copyPages(srcDoc, sortedPages);
        copiedPages.forEach(page => newDoc.addPage(page));
        const bytes = await newDoc.save();
        const baseName = fileName.replace('.pdf', '');
        downloadBlob(bytes, `${baseName}_merged_${sortedPages.map(p => p + 1).join('-')}.pdf`);
    };

    // --- Clear ---
    const clearAll = () => {
        setPdfFile(null);
        setFileName('');
        setPageCount(0);
        setThumbnails([]);
        setSelected(new Set());
    };

    const selectedCount = selected.size;

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
            {/* Header Bar */}
            <div className="no-print bg-gradient-to-r from-rose-600 to-rose-800 p-5 shadow-lg">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-2.5 text-white mb-1">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                            <Scissors size={18} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-xl font-black tracking-tight uppercase italic">DocStudio</h1>
                    </div>
                    <p className="text-[10px] text-rose-200 font-bold uppercase tracking-widest mt-0.5">
                        {t.subtitle}
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto w-full p-4 md:p-8 flex-grow">
                {/* Upload Zone */}
                {!pdfFile ? (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full min-h-[400px] border-3 border-dashed rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all ${isDragging
                            ? 'border-rose-400 bg-rose-50 scale-[1.01]'
                            : 'border-slate-300 bg-white hover:border-rose-300 hover:bg-rose-50/30'
                            }`}
                    >
                        <Upload size={64} strokeWidth={1.2} className={isDragging ? 'text-rose-400' : 'text-slate-300'} />
                        <div className="text-center">
                            <p className="text-lg font-bold text-slate-500">{t.dropZone}</p>
                            <p className="text-sm text-slate-400 mt-1">{t.dropHint}</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files[0])}
                        />
                    </div>
                ) : (
                    <>
                        {/* Toolbar */}
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="bg-slate-100 px-3 py-2 rounded-xl text-sm font-mono text-slate-600 max-w-[200px] truncate border border-slate-200">
                                    {fileName}
                                </div>
                                <span className="text-sm text-slate-500">
                                    {pageCount} {t.pages} · <strong className="text-rose-600">{selectedCount}</strong> {t.selected}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={selectAll}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                                    >
                                        {t.selectAll}
                                    </button>
                                    <button
                                        onClick={deselectAll}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                                    >
                                        {t.deselectAll}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={downloadIndividual}
                                    disabled={selectedCount === 0}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 text-white font-bold rounded-xl shadow-md hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                                >
                                    <FileDown size={14} /> {t.downloadIndividual}
                                </button>
                                <button
                                    onClick={downloadMerged}
                                    disabled={selectedCount === 0}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                                >
                                    <Layers size={14} /> {t.downloadMerged}
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="flex items-center gap-1.5 px-3 py-2.5 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 font-bold rounded-xl transition-all text-sm"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full" />
                                <span className="ml-4 text-slate-500 font-medium">{t.processing}</span>
                            </div>
                        )}

                        {/* Thumbnails Grid */}
                        {!isLoading && thumbnails.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {thumbnails.map((thumb, index) => {
                                    const isSelected = selected.has(index);
                                    return (
                                        <div
                                            key={index}
                                            onClick={() => togglePage(index)}
                                            className={`relative cursor-pointer group rounded-xl overflow-hidden shadow-md border-3 transition-all hover:shadow-lg hover:scale-[1.02] ${isSelected
                                                ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50'
                                                : 'border-transparent bg-white hover:border-slate-300'
                                                }`}
                                        >
                                            {/* Selection badge */}
                                            <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all ${isSelected
                                                ? 'bg-rose-500 text-white shadow-md'
                                                : 'bg-white/80 text-slate-400 border border-slate-200 group-hover:border-slate-400'
                                                }`}>
                                                {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                            </div>

                                            {/* Page number */}
                                            <div className="absolute top-2 right-2 z-10 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                {index + 1}
                                            </div>

                                            {/* Download single page */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); extractPage(index); }}
                                                className="absolute bottom-2 right-2 z-10 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-rose-600 hover:bg-white p-1.5 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all border border-slate-200"
                                                title={`${t.downloadPage} ${index + 1}`}
                                            >
                                                <FileDown size={12} />
                                            </button>

                                            {/* Thumbnail image */}
                                            <img
                                                src={thumb}
                                                alt={`${t.page} ${index + 1}`}
                                                className="w-full h-auto"
                                                draggable={false}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PdfSplitterView;
