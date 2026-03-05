import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Printer,
    FileText,
    Code,
    Languages,
    Maximize2,
    Minimize2,
    Shrink,
    RefreshCw,
    Download,
    Sparkles,
    Copy,
    Check,
    ZoomIn,
    ZoomOut,
    FileDown,
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import DocToolbar from './DocToolbar';
import { TEMPLATE_NOTEBOOKLM_PROMPT } from '../utils/prompts';

// =====================================================================
// Helper: Deep flatten JSON and group language keys
// =====================================================================
const flattenAndExtractLangFields = (data) => {
    const flat = {};
    const recurse = (obj, prefix = '') => {
        if (Array.isArray(obj)) {
            obj.forEach((item, i) => recurse(item, `${prefix}[${i}].`));
        } else if (obj !== null && typeof obj === 'object') {
            const isLangObj = Object.keys(obj).some(k => ['vn', 'en', 'jp'].includes(k)) &&
                Object.values(obj).every(v => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' || !v);
            if (isLangObj) {
                flat[prefix.replace(/\.$/, '')] = obj;
            } else {
                Object.entries(obj).forEach(([k, v]) => recurse(v, `${prefix}${k}.`));
            }
        } else {
            flat[prefix.replace(/\.$/, '')] = String(obj);
        }
    };
    recurse(data);

    const grouped = {};
    const langRegex = /_(vn|en|jp)$/;
    Object.entries(flat).forEach(([key, value]) => {
        const match = key.match(langRegex);
        if (match) {
            const baseKey = key.replace(langRegex, '');
            const lang = match[1];
            if (!grouped[baseKey]) grouped[baseKey] = {};
            if (typeof grouped[baseKey] === 'object') {
                grouped[baseKey][lang] = value;
            }
        } else {
            grouped[key] = value;
        }
    });

    // Alias specific legacy keys to simpler standard keys to match AI HTML Generation
    // e.g., 'table.rows[0].[1]' -> something easier, or 'company_info.name' -> 'company_info_name'
    const finalGroup = { ...grouped };
    Object.keys(grouped).forEach(k => {
        const cleanKey = k.replace(/[\.\[\]]/g, '_').replace(/__+/g, '_').replace(/_$/g, '');
        if (cleanKey !== k) {
            finalGroup[cleanKey] = grouped[k];
        }
    });

    return finalGroup;
};

// =====================================================================
// Dynamic HTML interpolator
// Replaces {{key}} with values from parsed Data
// =====================================================================
const interpolateHTML = (htmlTemplate, parsedData, currentLang) => {
    if (!htmlTemplate) return '';

    // Strip Gemini citation artifacts like [cite_start] and [cite: 5]
    let cleanHtml = htmlTemplate.replace(/\[cite_start\]\s*/g, '').replace(/\[cite:\s*\d+\]/g, '');

    return cleanHtml.replace(/\{\{([\w_]+)\}\}/g, (match, keyName) => {
        // Try exact match first, then fuzzy match
        let valObj = parsedData[keyName];

        // Fuzzy search for partial keys if exact not found (e.g., 'customer_name' matches 'doc_header_customerName')
        if (!valObj) {
            const foundKey = Object.keys(parsedData).find(k => k.toLowerCase().includes(keyName.toLowerCase()));
            if (foundKey) valObj = parsedData[foundKey];
        }

        if (valObj !== undefined && valObj !== null) {
            // If it's a language object
            if (typeof valObj === 'object' && ('vn' in valObj || 'en' in valObj || 'jp' in valObj)) {
                return valObj[currentLang] || valObj['vn'] || valObj['en'] || valObj['jp'] || '';
            }
            // If it's just a string/number
            return String(valObj);
        }

        // Return a red placeholder if data is missing, so it's visible to user
        return `<span class="bg-red-100 text-red-600 border border-red-300 px-1 rounded text-xs font-mono" title="Thiếu dữ liệu (Missing Key): ${keyName}">[${keyName}]</span>`;
    });
};

const htmlPromptText = `Chào bạn, tôi muốn nhờ bạn đọc hình ảnh phiếu kết quả đính kèm và tái tạo giúp tôi toàn bộ hình thức đồ họa của tờ giấy thành một đoạn mã HTML kết hợp Tailwind CSS.

Yêu cầu dành cho Mã HTML:
1. Vẽ lại khung xương (tables, borders, layouts) y hệt ảnh gốc bằng Tailwind CSS. Hãy để độ rộng các cột tự động co giãn mềm dẻo theo lượng text bên trong (flexible width), KHÔNG DÙNG phần trăm cứng.
2. Tuyệt đối không gõ cứng (hardcode) chữ của bất kỳ ngôn ngữ nào vào HTML. Mọi văn bản xuất hiện trên tờ giấy, từ "Chữ tĩnh" (tiêu đề cột, tên công ty in sẵn) đến "Chữ động" (thông số do con người điền) ĐỀU PHẢI được thay thế bằng một Biến Ngoặc Nhọn (Ví dụ: {{label_so_lo}} cho tiêu đề, {{so_lo}} cho chữ điền vào).
3. Chống Tràn Dòng & Xếp Chữ Dọc: Bản dịch tiếng Việt/Anh rất dài. BẮT BUỘC:
   - Ép bẻ từ bằng class "break-words" hoặc "whitespace-pre-wrap".
   - Xếp chữ theo chiều dọc "flex-col".
   - Dùng class thu nhỏ chữ như "text-[10px]" hoặc "text-xs", "leading-tight".
4. KHÔNG FIX CỨNG CHIỀU CAO: Tuyệt đối không dùng các class fix chiều cao (như h-32, h-64, min-h-[200px]) cho các khoảng trống/ô trống. Hãy để chiều cao tự động co giãn. Để tạo khoảng không gian thưa, chỉ dùng padding nhẹ (p-4).
5. Chỉ cần trả về nội dung bên trong cặp thẻ <div> bọc ngoài cùng.`;

const jsonPromptText = `Dựa trên bức ảnh phiếu kết quả này, và dựa vào danh sách các Biến Ngoặc Nhọn {{...}} mà bạn đã tạo cho tôi trong mẫu HTML, hãy giúp tôi trích xuất toàn bộ dữ liệu chữ số đang được điền trên giấy.

Yêu cầu đối với JSON:
1. Xin hãy xuất ra một chuỗi JSON phẳng. (KHÔNG bọc trong mảng Array []).
2. Key của JSON phải trùng khớp chính xác 100% với tên các Biến Ngoặc Nhọn ở bản thiết kế HTML.
3. Mỗi giá trị (Value) xin hãy dịch sang 3 ngôn ngữ và cung cấp dưới dạng Object với đuôi _vn, _en, _jp.

Ví dụ cấu trúc mong muốn:
{
  "label_so_lo": { "vn": "Số lô", "en": "Lot No.", "jp": "ロット番号" },
  "so_lo": { "vn": "1234", "en": "1234", "jp": "1234" },
  "ket_qua_kiem_nghiem": { "vn": "Đạt", "en": "Pass", "jp": "適" }
}`;

const PromptHelper = ({ title, promptText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(promptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="shrink-0 border-b border-slate-200 bg-sky-50 transition-all">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left px-3 py-2 hover:bg-sky-100 flex items-center justify-between transition-colors outline-none"
            >
                <div className="flex items-center gap-2 text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                    <Sparkles size={12} className={isOpen ? "text-amber-500" : ""} /> {title}
                </div>
                <div className="text-[10px] text-sky-500 font-medium">
                    {isOpen ? 'Đóng lại' : 'Bấm để Copy'}
                </div>
            </button>

            {isOpen && (
                <div className="px-3 pb-3 pt-1">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] text-slate-500 font-medium italic">Copy lệnh này gửi cho AI kèm theo hình ảnh:</p>
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white shadow-sm text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Đã Copy!' : 'Copy'}
                        </button>
                    </div>
                    <div className="text-[9px] font-mono whitespace-pre-wrap text-slate-600 max-h-32 overflow-y-auto p-2 bg-white border border-sky-100 rounded shadow-inner">
                        {promptText}
                    </div>
                </div>
            )}
        </div>
    );
};

const TemplateOverlayView = ({ displayLang: globalDisplayLang }) => {
    // -----------------------------------------------------------------
    // STATE
    // -----------------------------------------------------------------
    const [currentLang, setCurrentLang] = useState(globalDisplayLang || 'vn');
    const [isEditing, setIsEditing] = useState(false);
    const [contentScale, setContentScale] = useState(1);
    const [bodyFontSizeIndex, setBodyFontSizeIndex] = useState(4); // default 4 = text-sm
    const [isHeightTrimmed, setIsHeightTrimmed] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [customFont, setCustomFont] = useState(null);
    const [promptSource, setPromptSource] = useState('gemini');

    // Sync with global lang if it changes, but allow local override
    useEffect(() => {
        if (globalDisplayLang) setCurrentLang(globalDisplayLang);
    }, [globalDisplayLang]);
    const [htmlInput, setHtmlInput] = useState(`<div class="w-[210mm] min-h-[297mm] mx-auto bg-white border border-gray-200 shadow-xl p-10 font-sans text-sm text-gray-900 leading-relaxed">
  <div class="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-8">
    <div>
      <h1 class="text-2xl font-black uppercase tracking-widest">{{title}}</h1>
      <p class="text-xs text-gray-500 mt-1 uppercase">DocStudio Certification Template</p>
    </div>
    <div class="text-right">
      <div class="font-bold whitespace-pre-wrap">{{recipient}}</div>
      <div class="text-xs text-gray-600">{{date}}</div>
    </div>
  </div>

  <div class="mb-8">
    <table class="w-full text-left border-collapse">
       <tr>
        <td class="border border-gray-400 p-2 font-bold w-1/3 bg-gray-50">{{label_name}}</td>
        <td class="border border-gray-400 p-2 font-medium text-blue-900">{{customer_name}}</td>
       </tr>
       <tr>
        <td class="border border-gray-400 p-2 font-bold w-1/3 bg-gray-50">{{label_address}}</td>
        <td class="border border-gray-400 p-2">{{address}}</td>
       </tr>
       <tr>
        <td class="border border-gray-400 p-2 font-bold w-1/3 bg-gray-50">{{label_result}}</td>
        <td class="border border-gray-400 p-2 font-bold text-rose-700 text-xl">{{test_result}}</td>
       </tr>
    </table>
  </div>

  <div class="mt-20 flex justify-end">
    <div class="text-center w-64">
      <p class="mb-16 font-medium">{{director_title}}</p>
      <div class="w-32 h-32 rounded-full border border-red-500 mx-auto flex items-center justify-center opacity-30 transform -rotate-12">
        <span class="text-red-500 font-bold border border-red-500 p-1">ĐÃ DUYỆT</span>
      </div>
      <p class="font-bold border-t border-gray-400 mt-4 pt-2">{{director_name}}</p>
    </div>
  </div>
</div>`);

    const [jsonInput, setJsonInput] = useState(`{
  "title": { "vn": "GIẤY XÁC NHẬN KẾT QUẢ", "en": "CERTIFICATE OF RESULT", "jp": "結果証明書" },
  "recipient": { "vn": "Kính gửi: Công ty Sakura", "en": "To: Sakura Inc.", "jp": "さくら株式会社 御中" },
  "date": { "vn": "Hà Nội, Ngày 28 tháng 2 năm 2026", "en": "Hanoi, Feb 28, 2026", "jp": "2026年2月28日 ハノイ" },
  "label_name": { "vn": "Họ và tên / Sản phẩm", "en": "Name / Product", "jp": "氏名・製品名" },
  "customer_name": { "vn": "Nguyễn Văn A", "en": "Nguyen Van A", "jp": "グエン・ヴァン・A" },
  "label_address": { "vn": "Địa chỉ / Xuất xứ", "en": "Address / Origin", "jp": "住所・原産地" },
  "address": { "vn": "123 Đường B, TP Hà Nội", "en": "123 B St, Hanoi", "jp": "ハノイ市B通り123" },
  "label_result": { "vn": "Kết Luận Định Khoản", "en": "Final Judgment", "jp": "最終判定" },
  "test_result": { "vn": "ÂM TÍNH (ĐẠT CHUẨN)", "en": "NEGATIVE (PASSED)", "jp": "陰性（合格）" },
  "director_title": { "vn": "Giám đốc Trung tâm", "en": "Center Director", "jp": "センター所長" },
  "director_name": { "vn": "Trần Hải Bằng", "en": "Tran Hai Bang", "jp": "チャン・ハイ・バン" }
}`);

    const [parsedData, setParsedData] = useState({});
    const [jsonError, setJsonError] = useState('');

    // Print ref
    const printAreaRef = useRef(null);

    // -----------------------------------------------------------------
    // EFFECT: Parse JSON
    // -----------------------------------------------------------------
    useEffect(() => {
        try {
            let data = JSON.parse(jsonInput);

            // Unwrap if user pasted an array wrapper (like from Tab 1 JSON)
            if (Array.isArray(data) && data.length > 0) {
                data = data[0];
            }

            const flatData = flattenAndExtractLangFields(data);
            setParsedData(flatData);
            setJsonError('');
        } catch (err) {
            setJsonError('JSON không hợp lệ: ' + err.message);
        }
    }, [jsonInput]);

    // -----------------------------------------------------------------
    // RENDER: Interpolate HTML
    // -----------------------------------------------------------------
    const finalHtml = useMemo(() => {
        return interpolateHTML(htmlInput, parsedData, currentLang);
    }, [htmlInput, parsedData, currentLang]);

    // -----------------------------------------------------------------
    // HTML RESCUE TOOLS
    // -----------------------------------------------------------------
    const stepDownSpacing = () => {
        const scale = ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'];
        const res = htmlInput.replace(/\b([mp][tbyxlr]?-|gap-)(\d+|1\.5|2\.5|3\.5)(?![a-zA-Z0-9_-])/g, (match, prefix, val) => {
            const idx = scale.indexOf(val);
            if (idx > 0) return prefix + scale[Math.max(0, idx - 2)];
            return match;
        }).replace(/\b([mp][tbyxlr]?-|gap-)\[(\d+)px\](?![a-zA-Z0-9_-])/g, (match, prefix, val) => {
            const px = parseInt(val, 10);
            return `${prefix}[${Math.max(0, px - 8)}px]`;
        });
        setHtmlInput(res);
    };

    const clearHeights = () => {
        // Remove ALL h-* and min-h-* classes EXCEPT h-auto (which is harmless)
        const res = htmlInput
            .replace(/\b(min-h-|h-)(?!auto)([a-zA-Z0-9.[\]%-]+)(?![a-zA-Z0-9_-])/g, '')
            .replace(/\s{2,}/g, ' ');
        setHtmlInput(res);
        // Also disable the external 297mm wrapper locks
        setIsHeightTrimmed(true);
    };

    const changeFontSize = (direction) => {
        const FONT_SIZES = ['text-[9px]', 'text-[10px]', 'text-[11px]', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'];

        // 1. Update explicit text- classes in the HTML code
        const res = htmlInput.replace(/\btext-(xs|sm|base|lg|xl|[2-6]xl|\[\d+px\])(?!\w)/g, (match) => {
            let idx = FONT_SIZES.indexOf(match);
            if (idx === -1) {
                // Parse arbitrary px values like text-[13px]
                const pxMatch = match.match(/\[(\d+)px\]/);
                if (pxMatch) {
                    const px = parseInt(pxMatch[1], 10);
                    if (direction > 0) return `text-[${px + 1}px]`;
                    if (direction < 0) return `text-[${Math.max(6, px - 1)}px]`;
                }
                return match;
            }
            let newIdx = idx + direction;
            if (newIdx < 0) newIdx = 0;
            if (newIdx >= FONT_SIZES.length) newIdx = FONT_SIZES.length - 1;
            return FONT_SIZES[newIdx];
        });
        setHtmlInput(res);

        // 2. Update global wrapper font size to scale the body
        setBodyFontSizeIndex(prev => {
            let newIdx = prev + direction;
            if (newIdx < 0) newIdx = 0;
            if (newIdx >= FONT_SIZES.length) newIdx = FONT_SIZES.length - 1;
            return newIdx;
        });
    };

    // -----------------------------------------------------------------
    // PRINT ACTION & MANUAL EDIT
    // -----------------------------------------------------------------
    const handlePrint = () => {
        window.print();
    };

    // --- DOCX Export ---
    const handleExportDocx = async () => {
        if (!printAreaRef.current) return;
        const children = [];

        // Walk the DOM tree of the rendered preview
        const walkNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) return [new TextRun({ text, size: 22 })];
                return [];
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return [];

            const tag = node.tagName.toLowerCase();
            const childRuns = [];
            for (const child of node.childNodes) {
                childRuns.push(...walkNode(child));
            }

            // Handle table elements
            if (tag === 'table') {
                const rows = [];
                const trs = node.querySelectorAll('tr');
                trs.forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td, th').forEach(cell => {
                        const isBold = cell.tagName === 'TH' || cell.querySelector('b, strong') || window.getComputedStyle(cell).fontWeight >= 600;
                        cells.push(new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({ text: cell.textContent.trim(), bold: !!isBold, size: 20 })],
                            })],
                            width: { size: Math.floor(100 / Math.max(tr.children.length, 1)), type: WidthType.PERCENTAGE },
                        }));
                    });
                    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
                });
                if (rows.length > 0) {
                    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
                    children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
                }
                return [];
            }

            // Headings
            if (tag === 'h1') {
                children.push(new Paragraph({
                    children: childRuns.length ? childRuns.map(r => new TextRun({ ...r, bold: true, size: 32 })) : [new TextRun({ text: node.textContent.trim(), bold: true, size: 32 })],
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 },
                }));
                return [];
            }
            if (tag === 'h2') {
                children.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 28 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 160, after: 120 },
                }));
                return [];
            }
            if (tag === 'h3' || tag === 'h4') {
                children.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 120, after: 80 },
                }));
                return [];
            }

            // Paragraph / div with text
            if ((tag === 'p' || tag === 'div' || tag === 'span') && childRuns.length > 0) {
                // Skip if this is a container for block-level children
                const hasBlockChildren = [...node.children].some(c => ['DIV', 'TABLE', 'H1', 'H2', 'H3', 'P'].includes(c.tagName));
                if (!hasBlockChildren && node.textContent.trim()) {
                    const isBold = window.getComputedStyle(node).fontWeight >= 600;
                    children.push(new Paragraph({
                        children: [new TextRun({ text: node.textContent.trim(), bold: isBold, size: 22 })],
                        spacing: { after: 60 },
                    }));
                    return [];
                }
            }

            // Bold / Italic inline
            if (tag === 'b' || tag === 'strong') {
                return [new TextRun({ text: node.textContent.trim(), bold: true, size: 22 })];
            }
            if (tag === 'i' || tag === 'em') {
                return [new TextRun({ text: node.textContent.trim(), italics: true, size: 22 })];
            }

            return childRuns;
        };

        // Walk from the print target
        const printTarget = printAreaRef.current.querySelector('.print-target') || printAreaRef.current;
        for (const child of printTarget.childNodes) {
            walkNode(child);
        }

        if (children.length === 0) {
            children.push(new Paragraph({ children: [new TextRun({ text: printTarget.textContent.trim() || 'No content', size: 22 })] }));
        }

        const doc = new Document({ sections: [{ children }] });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `DocStudio_Template_${currentLang.toUpperCase()}.docx`);
    };

    const handlePreviewClick = (e) => {
        if (!isEditing || !e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.target;
        if (el && typeof el.className === 'string' && el.className.trim() !== '') {
            const oldClasses = el.className;
            const newClasses = oldClasses.replace(/\b([mp][tbyxlr]?-|gap-|h-|min-h-)[a-zA-Z0-9.\[\]-]+\b/g, '').replace(/\s{2,}/g, ' ').trim();
            if (oldClasses !== newClasses) {
                const oldBg = el.style.backgroundColor;
                el.style.backgroundColor = '#fecaca';
                setTimeout(() => { el.style.backgroundColor = oldBg; }, 300);

                // Update HTML string directly to persist changes through language swap
                setHtmlInput(prev => {
                    // Escape special characters for regex
                    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Treat any sequence of whitespaces in old class string as flexible
                    const searchClass = escapeRegExp(oldClasses).replace(/\s+/g, '\\s+');
                    // Match class attribute exactly matching the string
                    const regex = new RegExp(`class=['"]\\s*${searchClass}\\s*['"]`, 'g');
                    return prev.replace(regex, `class="${newClasses}"`);
                });
            }
        }
    };

    return (
        <>
            {/* Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          @page { size: A4; margin: 0; }
          * { overflow: visible !important; }
          body * { visibility: hidden; }
          .print-target, .print-target * { visibility: visible; }
          .print-target {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            ${isHeightTrimmed ? 'height: auto !important; min-height: auto !important;' : 'height: 297mm !important; min-height: 297mm !important;'}
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background-color: white !important;
            overflow: hidden !important; 
          }
          .print-target * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

            <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-900">

                {/* ============================================================
                    LEFT PANEL — SIDEBAR
                ============================================================ */}
                <aside className="no-print w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col shadow-sm z-[60]">

                    {/* Brand Header */}
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-fuchsia-600 to-fuchsia-800 shrink-0">
                        <div className="flex items-center gap-2.5 text-white mb-1">
                            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                                <Code size={18} strokeWidth={2.5} className="text-white" />
                            </div>
                            <h1 className="text-xl font-black tracking-tight uppercase italic">DocStudio</h1>
                        </div>
                        <p className="text-[10px] text-fuchsia-200 font-bold uppercase tracking-widest mt-0.5">
                            Dynamic HTML Builder
                        </p>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar">

                        {/* Prompt Source Toggle */}
                        <div className="flex gap-1 p-1 mx-4 mt-4 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setPromptSource('gemini')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${promptSource === 'gemini' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                ✨ Gemini
                            </button>
                            <button
                                onClick={() => setPromptSource('notebooklm')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${promptSource === 'notebooklm' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                📓 NotebookLM
                            </button>
                        </div>

                        {/* Prompt Helpers */}
                        {promptSource === 'gemini' ? (
                            <>
                                <PromptHelper title="Lệnh AI Vẽ HTML Template" promptText={htmlPromptText} />
                                <PromptHelper title="Lệnh AI Trích Xuất JSON" promptText={jsonPromptText} />
                            </>
                        ) : (
                            <PromptHelper title="Hướng dẫn NotebookLM (HTML + JSON)" promptText={TEMPLATE_NOTEBOOKLM_PROMPT} />
                        )}

                        {/* HTML Template Input */}
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Code size={13} /> HTML Template
                                </label>
                                {/* Rescue Tools */}
                                <div className="flex items-center gap-1">
                                    <button onClick={() => changeFontSize(1)} className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold transition-all" title="Tăng font">A+</button>
                                    <button onClick={() => changeFontSize(-1)} className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold transition-all" title="Giảm font">A-</button>
                                    <button onClick={clearHeights} className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold transition-all flex items-center gap-0.5" title="Gọt chiều cao">
                                        <Minimize2 size={8} className="text-rose-500" /> H
                                    </button>
                                    <button onClick={stepDownSpacing} className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold transition-all flex items-center gap-0.5" title="Ép khoảng trắng">
                                        <Shrink size={8} className="text-emerald-500" /> S
                                    </button>
                                </div>
                            </div>
                            <textarea
                                className="w-full h-40 p-3 bg-[#1E1E1E] text-blue-300 font-mono text-[10px] leading-relaxed rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none shadow-inner"
                                value={htmlInput}
                                onChange={(e) => setHtmlInput(e.target.value)}
                                spellCheck="false"
                                placeholder="Dán mã HTML/Tailwind do Gemini gen vào đây..."
                            />

                            {/* JSON Data Input */}
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText size={13} /> Dữ Liệu JSON
                                </label>
                                {jsonError && <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded truncate max-w-[140px]">{jsonError}</span>}
                            </div>
                            <textarea
                                className={`w-full h-36 p-3 bg-[#1E1E1E] text-emerald-300 font-mono text-[10px] leading-relaxed rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none shadow-inner ${jsonError ? 'ring-2 ring-red-500' : ''}`}
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                spellCheck="false"
                                placeholder='Dán JSON từ Gemini với định dạng _vn, _en, _jp...'
                            />

                            {/* Zoom control */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Zoom Preview</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setContentScale(s => Math.max(0.4, Number((s - 0.05).toFixed(2))))} className="px-2 py-0.5 bg-white rounded shadow-sm hover:bg-slate-100 text-xs font-bold text-slate-600">-</button>
                                    <span className="w-10 text-center text-[10px] text-slate-600 font-bold">{Math.round(contentScale * 100)}%</span>
                                    <button onClick={() => setContentScale(s => Math.min(2, Number((s + 0.05).toFixed(2))))} className="px-2 py-0.5 bg-white rounded shadow-sm hover:bg-slate-100 text-xs font-bold text-slate-600">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            {isEditing && (
                                <span className="flex items-center gap-1 text-amber-600 font-bold">
                                    <Sparkles size={10} /> Giữ ALT + Click để gọt spacing
                                </span>
                            )}
                        </div>
                    </div>
                </aside>

                {/* ============================================================
                    RIGHT PANEL — PREVIEW
                ============================================================ */}
                <main className="flex-grow bg-slate-200 min-h-screen relative p-4 md:p-8 flex flex-col items-center">

                    {/* Floating Toolbar */}
                    <DocToolbar
                        displayLang={currentLang}
                        onLangChange={setCurrentLang}
                        langOptions={['vn', 'en', 'jp']}
                        accentColor="fuchsia"
                        showFontPicker={true}
                        currentFont={customFont || "'Times New Roman', serif"}
                        onFontChange={setCustomFont}
                        showEdit={true}
                        isEditing={isEditing}
                        onToggleEdit={() => setIsEditing(!isEditing)}
                        zoomLevel={zoomLevel}
                        onZoomChange={setZoomLevel}
                        onExportDocx={handleExportDocx}
                        onPrint={handlePrint}
                        printLabel="PDF"
                    />

                    {/* Document Canvas */}
                    <div className="flex flex-col gap-10 pb-24 items-center w-full" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                        <div
                            className={`bg-white shadow-2xl transition-all print-target outline-none relative 
                            ${['text-[9px]', 'text-[10px]', 'text-[11px]', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'][bodyFontSizeIndex]}
                            [&>div]:max-w-none [&>div]:w-full [&>div]:m-0 [&>div]:border-none [&>div]:shadow-none
                            ${isEditing ? 'ring-4 ring-amber-400 border-amber-500' : ''}
                            ${customFont ? 'custom-font-active' : ''}`}
                            style={{
                                width: '210mm',
                                minHeight: isHeightTrimmed ? 'auto' : '297mm',
                                padding: '12mm',
                                ...(customFont ? { '--custom-font': customFont, fontFamily: customFont } : {}),
                            }}
                            contentEditable={isEditing}
                            suppressContentEditableWarning={true}
                            onClick={handlePreviewClick}
                        >
                            {/* Inner Scaling Wrapper */}
                            <div
                                style={{
                                    transform: `scale(${contentScale})`,
                                    transformOrigin: 'top left',
                                    width: `${100 / contentScale}%`,
                                    ...(isHeightTrimmed ? {} : { minHeight: `${100 / contentScale}%` })
                                }}
                                dangerouslySetInnerHTML={{ __html: finalHtml }}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
};

export default TemplateOverlayView;
