import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    DndContext,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    Upload,
    FileDown,
    Settings,
    Image as ImageIcon,
    Type,
    AlertCircle,
    Printer,
    Maximize2
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// =====================================================================
// Custom Draggable Label Component
// =====================================================================
const DraggableLabel = ({ id, label, position, value, fontScale }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: id,
        data: { label, value },
    });

    const style = {
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: CSS.Translate.toString(transform),
        fontSize: `${14 * fontScale}px`,
        touchAction: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="absolute z-10 whitespace-nowrap bg-white/80 backdrop-blur-sm px-2 py-0.5 border border-dashed border-rose-400 text-rose-700 font-bold rounded-md shadow-sm cursor-grab active:cursor-grabbing hover:bg-white hover:border-solid hover:shadow-md transition-colors"
        >
            {value || `[${label}]`}
            {/* Anchor dot */}
            <div className="absolute top-0 left-0 w-2 h-2 bg-rose-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
    );
};

// =====================================================================
// TemplateOverlayView — The Pixel-Perfect Overlay Module
// =====================================================================
const TemplateOverlayView = ({ displayLang }) => {
    const [bgPdfBytes, setBgPdfBytes] = useState(null);
    const [bgImageSrc, setBgImageSrc] = useState(null);
    const [bgDimensions, setBgDimensions] = useState({ width: 0, height: 0 }); // PDF intrinsic sizes
    const [jsonInput, setJsonInput] = useState('{\n  "customerName": { "vn": "Nguyễn Văn A", "en": "Nguyen Van A", "jp": "グエン・ヴァン・A" },\n  "testResult": { "vn": "Âm tính", "en": "Negative", "jp": "陰性" },\n  "date": { "vn": "10/10/2026", "en": "Oct 10, 2026", "jp": "2026年10月10日" }\n}');
    const [parsedData, setParsedData] = useState({});
    const [fields, setFields] = useState([]); // Array of { id, position: {x, y}, fontScale }
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState('');
    const workspaceRef = useRef(null);

    // --- Parse JSON ---
    useEffect(() => {
        try {
            const data = JSON.parse(jsonInput);
            setParsedData(data);
            setError('');

            // Initialize fields if new keys found
            setFields((prev) => {
                const currentIds = prev.map(f => f.id);
                const newFields = [...prev];
                Object.keys(data).forEach((key, index) => {
                    if (!currentIds.includes(key)) {
                        // Default position scattered slightly to not overlap completely
                        newFields.push({
                            id: key,
                            position: { x: 10, y: 10 + (index * 5) },
                            fontScale: 1.0
                        });
                    }
                });
                // Remove deleted keys
                return newFields.filter(f => Object.keys(data).includes(f.id));
            });
        } catch (err) {
            setError('JSON không hợp lệ');
        }
    }, [jsonInput]);

    // --- Upload Background PDF ---
    const handleBgUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            setBgPdfBytes(arrayBuffer);

            // Render 1st page to image for background mapping
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 }); // High res for bg
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            setBgImageSrc(canvas.toDataURL('image/jpeg', 0.8));

            // Get intrinsic dimensions of the PDF page in points
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            setBgDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

        } catch (err) {
            console.error('Error loading BG PDF:', err);
            setError('Không thể đọc file PDF nền');
        }
    };

    // --- DndKit Sensors ---
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
    );

    // --- Handle drag end ---
    const handleDragEnd = (event) => {
        const { active, delta } = event;
        if (!workspaceRef.current) return;

        // Convert delta px to percentage of workspace to be responsive
        const rect = workspaceRef.current.getBoundingClientRect();
        const deltaXPercent = (delta.x / rect.width) * 100;
        const deltaYPercent = (delta.y / rect.height) * 100;

        setFields((fields) =>
            fields.map((f) => {
                if (f.id === active.id) {
                    return {
                        ...f,
                        position: {
                            x: Math.max(0, Math.min(100, f.position.x + deltaXPercent)),
                            y: Math.max(0, Math.min(100, f.position.y + deltaYPercent)),
                        },
                    };
                }
                return f;
            })
        );
    };

    // --- Change Font Size for a field ---
    const updateFontScale = (id, newScale) => {
        setFields(fields.map(f => f.id === id ? { ...f, fontScale: parseFloat(newScale) } : f));
    };

    // --- Get Lang Value ---
    const getLangVal = (keyObj) => {
        if (!keyObj) return '';
        if (typeof keyObj === 'string') return keyObj;
        return keyObj[displayLang] || keyObj['vn'] || keyObj['en'] || '';
    };

    // --- Export PDF Core Engine ---
    const handleExport = async () => {
        if (!bgPdfBytes) {
            setError('Vui lòng upload file PDF mẫu trước');
            return;
        }
        setIsExporting(true);

        try {
            // 1. Load Background PDF
            const pdfDoc = await PDFDocument.load(bgPdfBytes);
            pdfDoc.registerFontkit(fontkit);

            // 2. Fetch our custom font to support Vietnamese
            // In a real app we might fetch from a full CDN URL or local public dir
            const fontResponse = await fetch('/fonts/Roboto-Regular.ttf');
            if (!fontResponse.ok) console.warn('Roboto font not found locally. Fallback might fail on VN text.');
            const fontBytes = await fontResponse.arrayBuffer();

            // Embed the font
            const robotoFont = await pdfDoc.embedFont(fontBytes);

            // 3. Draw text on ALL pages or just the first page? (Assuming 1 page template for now)
            const pages = pdfDoc.getPages();
            const page = pages[0];
            const { width: pdfW, height: pdfH } = page.getSize();

            // 4. Map and inject fields
            fields.forEach((field) => {
                const textObj = parsedData[field.id];
                const textVal = getLangVal(textObj);

                // Convert Percentage (0-100) to absolute PDF points
                // NOTE: pdf-lib uses Bottom-Left as (0,0). So Y needs inversion.
                const absoluteX = (field.position.x / 100) * pdfW;
                const absoluteY = pdfH - ((field.position.y / 100) * pdfH); // Inverted Y

                // fontSize config
                const baseSize = 12; // 12pt is standard
                const finalSize = baseSize * field.fontScale;

                page.drawText(textVal, {
                    x: absoluteX,
                    y: absoluteY - (finalSize * 0.7), // Shift down roughly line height because drawText aligns bottom-left
                    size: finalSize,
                    font: robotoFont,
                    color: rgb(0, 0, 0), // Black
                });
            });

            // 5. Save and Download
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Overlay_${displayLang}_${new Date().getTime()}.pdf`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Export Failed:', err);
            setError('Lỗi khi xuất PDF. Chi tiết: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-800">

            {/* HEADER */}
            <div className="no-print bg-slate-900 border-b border-rose-500/30 p-4 shrink-0 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-9 h-9 bg-rose-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-rose-500/50">
                            <Printer size={18} className="text-rose-400" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight uppercase">Pixel/Perfect</h1>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Template Overlay Engine</p>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={!bgPdfBytes || isExporting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileDown size={16} /> {isExporting ? 'Đang xuất PDF...' : 'In / Xuất PDF'}
                    </button>
                </div>
            </div>

            {/* ERROR BANNER */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 mx-4 mt-4 rounded-r-lg flex items-center gap-3 text-red-700 shadow-sm max-w-7xl xl:mx-auto w-full">
                    <AlertCircle size={18} /> <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* MAIN WORKSPACE */}
            <div className="flex-grow flex flex-col md:flex-row gap-6 p-4 md:p-6 max-w-[1600px] mx-auto w-full h-[calc(100vh-80px)]">

                {/* LEFT PANEL: Data & Config */}
                <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">

                    {/* Step 1: Upload Template */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                            <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">1</span>
                            File Nền (Mẫu trống)
                        </h3>
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <ImageIcon className="w-6 h-6 mb-2 text-slate-400" />
                                <p className="text-xs text-slate-500 font-medium">Bấm để chọn PDF mẫu</p>
                            </div>
                            <input type="file" className="hidden" accept=".pdf" onChange={handleBgUpload} />
                        </label>
                        {bgPdfBytes && (
                            <div className="mt-3 p-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 flex items-center gap-2">
                                ✅ Đã nạp file nền ({bgDimensions.width.toFixed(0)}x{bgDimensions.height.toFixed(0)}pt)
                            </div>
                        )}
                    </div>

                    {/* Step 2: JSON Data */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex-grow flex flex-col min-h-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                            <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">2</span>
                            Dữ liệu phẳng (JSON)
                        </h3>
                        <textarea
                            className="w-full flex-grow p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none border border-slate-700 shadow-inner"
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            spellCheck="false"
                        />
                    </div>

                </div>

                {/* RIGHT PANEL: Canvas Workspace */}
                <div className="flex-grow bg-slate-200/50 rounded-3xl border-2 border-slate-200 overflow-hidden relative shadow-inner flex flex-col">

                    {/* Toolbar inner */}
                    <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                <span className="w-5 h-5 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">3</span>
                                Kéo thả chữ vào vị trí
                            </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 font-medium bg-slate-100 px-3 py-1 rounded-lg">
                            <Maximize2 size={12} /> Auto-scale Canvas
                        </div>
                    </div>

                    {/* Draggable Area */}
                    <div className="flex-grow overflow-auto p-4 flex justify-center bg-[#E5E5F7]" style={{ backgroundImage: 'radial-gradient(#444cf7 0.5px, #E5E5F7 0.5px)', backgroundSize: '10px 10px' }}>

                        {!bgImageSrc ? (
                            <div className="my-auto text-center text-slate-400 flex flex-col items-center max-w-sm">
                                <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center mb-4">
                                    <ImageIcon size={24} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-lg text-slate-500 mb-2">Chưa có Background</p>
                                <p className="text-sm">Vui lòng tải lên 1 file PDF mẫu trống ở cột bên trái để làm nền mapping.</p>
                            </div>
                        ) : (
                            // The Page Envelope wrapper
                            <div className="relative bg-white shadow-2xl" style={{
                                // Keep aspect ratio identical to PDF
                                aspectRatio: `${bgDimensions.width} / ${bgDimensions.height}`,
                                maxHeight: '100%',
                                // allow it to scale
                            }}>

                                {/* Visual Image Background */}
                                <img
                                    src={bgImageSrc}
                                    alt="Template Background"
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-90"
                                />

                                {/* DND Context for the overlay layer */}
                                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                                    <div
                                        ref={workspaceRef}
                                        className="absolute inset-0 w-full h-full"
                                    >
                                        {fields.map((field) => (
                                            <DraggableLabel
                                                key={field.id}
                                                id={field.id}
                                                label={field.id}
                                                position={field.position}
                                                value={getLangVal(parsedData[field.id])}
                                                fontScale={field.fontScale}
                                            />
                                        ))}
                                    </div>
                                </DndContext>

                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHTMOST PANEL: Field Config */}
                {fields.length > 0 && bgImageSrc && (
                    <div className="w-full md:w-64 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 shrink-0 overflow-y-auto hidden xl:block">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Settings size={14} /> Tùy chỉnh (Cỡ chữ)
                        </h3>
                        <div className="space-y-4">
                            {fields.map(f => (
                                <div key={f.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="text-xs font-bold text-slate-700 truncate mb-2" title={f.id}>#{f.id}</div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                        <span>X: {f.position.x.toFixed(1)}%</span>
                                        <span>Y: {f.position.y.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Type size={12} className="text-slate-400" />
                                        <input
                                            type="range"
                                            min="0.5" max="3" step="0.1"
                                            value={f.fontScale}
                                            onChange={(e) => updateFontScale(f.id, e.target.value)}
                                            className="flex-grow accent-rose-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <span className="text-[10px] font-mono text-slate-500 w-6 font-bold text-right">{f.fontScale.toFixed(1)}x</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TemplateOverlayView;
