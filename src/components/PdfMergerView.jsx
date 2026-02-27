import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    Upload,
    FileDown,
    Layers,
    Trash2,
    GripVertical,
    FilePlus2,
    X,
    Combine,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// =====================================================================
// UI Translations
// =====================================================================
const uiText = {
    vn: {
        title: 'Ghép File PDF',
        subtitle: 'Tải lên nhiều file PDF và ghép thành 1 file duy nhất',
        dropZone: 'Kéo thả file PDF vào đây',
        dropSub: 'hoặc click để chọn file (chọn nhiều file)',
        addMore: 'Thêm file',
        mergeBtn: 'Ghép tất cả',
        clearBtn: 'Xóa tất cả',
        removeFile: 'Xóa',
        pages: 'trang',
        totalPages: 'Tổng:',
        files: 'file',
        dragHint: 'Kéo thả để thay đổi thứ tự',
        processing: 'Đang xử lý...',
        merging: 'Đang ghép file...',
    },
    en: {
        title: 'Merge PDF Files',
        subtitle: 'Upload multiple PDF files and merge into a single file',
        dropZone: 'Drag & drop PDF files here',
        dropSub: 'or click to select files (multi-select)',
        addMore: 'Add more',
        mergeBtn: 'Merge all',
        clearBtn: 'Clear all',
        removeFile: 'Remove',
        pages: 'pages',
        totalPages: 'Total:',
        files: 'files',
        dragHint: 'Drag to reorder',
        processing: 'Processing...',
        merging: 'Merging files...',
    },
    jp: {
        title: 'PDF結合',
        subtitle: '複数のPDFファイルをアップロードして1つに結合',
        dropZone: 'PDFファイルをここにドラッグ＆ドロップ',
        dropSub: 'またはクリックで選択（複数可）',
        addMore: '追加',
        mergeBtn: 'すべて結合',
        clearBtn: 'すべて削除',
        removeFile: '削除',
        pages: 'ページ',
        totalPages: '合計:',
        files: 'ファイル',
        dragHint: 'ドラッグで並べ替え',
        processing: '処理中...',
        merging: '結合中...',
    },
};

// =====================================================================
// PdfMergerView — Upload multiple PDFs, reorder, merge
// =====================================================================
const PdfMergerView = ({ displayLang }) => {
    const [files, setFiles] = useState([]); // [{ id, name, arrayBuffer, pageCount, thumbnail }]
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [dragOverId, setDragOverId] = useState(null);
    const [dragItemId, setDragItemId] = useState(null);
    const fileInputRef = useRef(null);
    const addFileInputRef = useRef(null);

    const t = uiText[displayLang] || uiText.vn;

    // --- Process a single PDF file ---
    const processFile = useCallback(async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const buffer = e.target.result;
                    // Get page count
                    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
                    const pageCount = pdf.numPages;

                    // Generate first-page thumbnail
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 0.3 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.6);

                    resolve({
                        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        name: file.name,
                        arrayBuffer: buffer,
                        pageCount,
                        thumbnail,
                    });
                } catch (err) {
                    console.error('Error processing file:', file.name, err);
                    resolve(null);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }, []);

    // --- Handle file selection ---
    const handleFiles = useCallback(async (fileList) => {
        const pdfFiles = [...fileList].filter(f => f.type === 'application/pdf');
        if (pdfFiles.length === 0) return;

        setIsProcessing(true);
        const results = [];
        for (const file of pdfFiles) {
            const result = await processFile(file);
            if (result) results.push(result);
        }
        setFiles(prev => [...prev, ...results]);
        setIsProcessing(false);
    }, [processFile]);

    // --- Drag & Drop zone ---
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    // --- Remove file ---
    const removeFile = (id) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    // --- Clear all ---
    const clearAll = () => setFiles([]);

    // --- Drag & Drop reorder ---
    const handleItemDragStart = (e, id) => {
        setDragItemId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleItemDragOver = (e, id) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (id !== dragOverId) setDragOverId(id);
    };

    const handleItemDrop = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragItemId || dragItemId === targetId) {
            setDragItemId(null);
            setDragOverId(null);
            return;
        }
        setFiles(prev => {
            const items = [...prev];
            const fromIdx = items.findIndex(f => f.id === dragItemId);
            const toIdx = items.findIndex(f => f.id === targetId);
            if (fromIdx < 0 || toIdx < 0) return prev;
            const [moved] = items.splice(fromIdx, 1);
            items.splice(toIdx, 0, moved);
            return items;
        });
        setDragItemId(null);
        setDragOverId(null);
    };

    const handleItemDragEnd = () => {
        setDragItemId(null);
        setDragOverId(null);
    };

    // --- Merge all PDFs ---
    const handleMerge = async () => {
        if (files.length < 2) return;
        setIsMerging(true);
        try {
            const mergedDoc = await PDFDocument.create();
            for (const file of files) {
                const srcDoc = await PDFDocument.load(file.arrayBuffer);
                const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
                pages.forEach(page => mergedDoc.addPage(page));
            }
            const bytes = await mergedDoc.save();

            // Download
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `merged_${files.length}_files.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Merge error:', err);
        } finally {
            setIsMerging(false);
        }
    };

    const totalPages = files.reduce((sum, f) => sum + f.pageCount, 0);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
            {/* Header */}
            <div className="no-print bg-gradient-to-r from-violet-600 to-violet-800 p-5 shadow-lg">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-2.5 text-white mb-1">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                            <Combine size={18} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-xl font-black tracking-tight uppercase italic">DocStudio</h1>
                    </div>
                    <p className="text-[10px] text-violet-200 font-bold uppercase tracking-widest mt-0.5">
                        {t.title}
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full p-4 md:p-8 flex-grow">

                {/* Upload Zone (shown when no files OR always as add-more) */}
                {files.length === 0 ? (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full min-h-[400px] border-3 border-dashed rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all ${isDragging
                                ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                                : 'border-slate-300 bg-white hover:border-violet-300 hover:bg-violet-50/30'
                            }`}
                    >
                        <Upload size={64} strokeWidth={1.2} className={isDragging ? 'text-violet-400' : 'text-slate-300'} />
                        <div className="text-center">
                            <p className="text-lg font-bold text-slate-500">{t.dropZone}</p>
                            <p className="text-sm text-slate-400 mt-1">{t.dropSub}</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </div>
                ) : (
                    <>
                        {/* Toolbar */}
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm text-slate-500">
                                    <strong className="text-violet-600">{files.length}</strong> {t.files} ·
                                    {' '}{t.totalPages} <strong className="text-violet-600">{totalPages}</strong> {t.pages}
                                </span>
                                <span className="text-xs text-slate-400 italic hidden sm:block">💡 {t.dragHint}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => addFileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-violet-600 font-bold rounded-xl border border-violet-200 hover:bg-violet-50 transition-all text-sm"
                                >
                                    <FilePlus2 size={14} /> {t.addMore}
                                </button>
                                <input
                                    ref={addFileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                                />
                                <button
                                    onClick={handleMerge}
                                    disabled={files.length < 2 || isMerging}
                                    className="flex items-center gap-1.5 px-5 py-2.5 bg-violet-600 text-white font-bold rounded-xl shadow-md hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                                >
                                    <Layers size={14} /> {isMerging ? t.merging : t.mergeBtn}
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="flex items-center gap-1.5 px-3 py-2.5 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 font-bold rounded-xl transition-all text-sm"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Processing indicator */}
                        {isProcessing && (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full" />
                                <span className="ml-3 text-slate-500 font-medium">{t.processing}</span>
                            </div>
                        )}

                        {/* File list — draggable */}
                        <div className="space-y-3">
                            {files.map((file, index) => (
                                <div
                                    key={file.id}
                                    draggable
                                    onDragStart={(e) => handleItemDragStart(e, file.id)}
                                    onDragOver={(e) => handleItemDragOver(e, file.id)}
                                    onDrop={(e) => handleItemDrop(e, file.id)}
                                    onDragEnd={handleItemDragEnd}
                                    className={`flex items-center gap-4 p-4 bg-white rounded-2xl shadow-md border-2 transition-all cursor-grab active:cursor-grabbing group ${dragOverId === file.id && dragItemId !== file.id
                                            ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                                            : dragItemId === file.id
                                                ? 'opacity-50 border-slate-300'
                                                : 'border-transparent hover:border-violet-200 hover:shadow-lg'
                                        }`}
                                >
                                    {/* Drag handle */}
                                    <div className="text-slate-300 group-hover:text-violet-400 transition-colors shrink-0">
                                        <GripVertical size={20} />
                                    </div>

                                    {/* Order number */}
                                    <div className="w-9 h-9 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center font-black text-lg shrink-0">
                                        {index + 1}
                                    </div>

                                    {/* Thumbnail */}
                                    <div className="w-14 h-18 bg-slate-100 rounded-lg overflow-hidden shadow-sm shrink-0 border border-slate-200">
                                        <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                                    </div>

                                    {/* File info */}
                                    <div className="flex-grow min-w-0">
                                        <p className="font-bold text-sm text-slate-700 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {file.pageCount} {t.pages}
                                        </p>
                                    </div>

                                    {/* Remove button */}
                                    <button
                                        onClick={() => removeFile(file.id)}
                                        className="shrink-0 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title={t.removeFile}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Drop zone for adding more (below the list) */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                            className={`mt-6 w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${isDragging
                                    ? 'border-violet-400 bg-violet-50'
                                    : 'border-slate-200 bg-white/50 hover:border-violet-300 hover:bg-violet-50/30'
                                }`}
                            onClick={() => addFileInputRef.current?.click()}
                        >
                            <FilePlus2 size={28} className={isDragging ? 'text-violet-400' : 'text-slate-300'} />
                            <p className="text-sm text-slate-400 font-medium">{t.dropZone}</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PdfMergerView;
