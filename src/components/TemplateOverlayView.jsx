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
    Wand2,
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import DocToolbar from './DocToolbar';
import { TEMPLATE_NOTEBOOKLM_PROMPT, TWO_COL_HTML_PROMPT, TWO_COL_JSON_PROMPT, TWO_COL_NOTEBOOKLM_PROMPT } from '../utils/prompts';

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
// Sanitize AI HTML: strip outer wrapper div that causes double w-[210mm]
// =====================================================================
const sanitizeHtml = (html) => {
    if (!html) return '';
    let clean = html.trim();
    // Strip Gemini citation artifacts
    clean = clean.replace(/\[cite_start\]\s*/g, '').replace(/\[cite:\s*\d+\]/g, '');
    // Remove markdown code fences
    clean = clean.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim();
    // Strip outer wrapper div that has w-[210mm] or min-h-[297mm] to avoid double sizing
    const outerMatch = clean.match(/^<div[^>]*class="[^"]*w-\[210mm\][^"]*"[^>]*>([\s\S]*)<\/div>\s*$/);
    if (outerMatch) {
        clean = outerMatch[1].trim();
    }
    return clean;
};

// =====================================================================
// Dynamic HTML interpolator
// Replaces {{key}} with values from parsed Data
// Splits by <!-- PAGE BREAK --> and returns array of page HTML strings
// =====================================================================
const interpolateHTML = (htmlTemplate, parsedData, currentLang) => {
    if (!htmlTemplate) return [''];

    const sanitized = sanitizeHtml(htmlTemplate);

    const interpolateSingle = (html) => {
        return html.replace(/\{\{([\w_]+)\}\}/g, (match, keyName) => {
            let valObj = parsedData[keyName];
            if (!valObj) {
                const foundKey = Object.keys(parsedData).find(k => k.toLowerCase().includes(keyName.toLowerCase()));
                if (foundKey) valObj = parsedData[foundKey];
            }
            if (valObj !== undefined && valObj !== null) {
                if (typeof valObj === 'object' && ('vn' in valObj || 'en' in valObj || 'jp' in valObj)) {
                    return valObj[currentLang] || valObj['vn'] || valObj['en'] || valObj['jp'] || '';
                }
                return String(valObj);
            }
            return `<span class="bg-red-100 text-red-600 border border-red-300 px-1 rounded text-xs font-mono" title="Thiếu dữ liệu: ${keyName}">[${keyName}]</span>`;
        });
    };

    // Split by PAGE BREAK marker (case-insensitive, flexible whitespace)
    const pages = sanitized.split(/<!--\s*PAGE\s*BREAK\s*-->/i).map(p => p.trim()).filter(Boolean);
    return pages.length > 0 ? pages.map(interpolateSingle) : [interpolateSingle(sanitized)];
};

const htmlPromptText = `Chào bạn, tôi muốn nhờ bạn đọc hình ảnh phiếu kết quả đính kèm và tái tạo giúp tôi toàn bộ hình thức đồ họa của tờ giấy thành một đoạn mã HTML kết hợp Tailwind CSS.

Yêu cầu dành cho Mã HTML:
1. Vẽ lại khung xương (tables, borders, layouts) y hệt ảnh gốc bằng Tailwind CSS. Hãy để độ rộng các cột tự động co giãn mềm dẻo theo lượng text bên trong (flexible width), KHÔNG DÙNG phần trăm cứng.
2. Tuyệt đối không gõ cứng (hardcode) chữ của bất kỳ ngôn ngữ nào vào HTML. Mọi văn bản ĐỀU PHẢI được thay thế bằng Biến Ngoặc Nhọn (Ví dụ: {{label_so_lo}}, {{so_lo}}).
3. Chống Tràn Dòng: BẮT BUỘC dùng class "break-words", "text-[10px]" hoặc "text-xs", "leading-tight".
4. KHÔNG FIX CỨNG CHIỀU CAO: Không dùng h-32, h-64, min-h-[200px]. Để chiều cao tự co giãn.
5. KHÔNG bao bọc bằng div có w-[210mm] hoặc min-h-[297mm]. Hệ thống sẽ tự đặt khung A4. Chỉ trả về NỘI DUNG bên trong.
6. Nếu tài liệu có NHIỀU TRANG: Đặt dấu phân cách <!-- PAGE BREAK --> giữa mỗi trang. Hệ thống sẽ tự động tách thành các trang A4 riêng biệt.`;

const jsonPromptText = `Dựa trên bức ảnh phiếu kết quả, và dựa vào danh sách các Biến Ngoặc Nhọn {{...}} trong mẫu HTML, hãy trích xuất toàn bộ dữ liệu.

Yêu cầu đối với JSON:
1. Xuất ra một chuỗi JSON phẳng. (KHÔNG bọc trong mảng Array []).
2. Key của JSON phải trùng khớp chính xác 100% với tên các Biến Ngoặc Nhọn.
3. Mỗi giá trị dịch sang 3 ngôn ngữ: { "vn": "...", "en": "...", "jp": "..." }
4. Nếu tài liệu có NHIỀU TRANG: Gom TẤT CẢ dữ liệu của mọi trang vào 1 JSON duy nhất. Dùng prefix để phân biệt trang (ví dụ: page1_title, page2_title).`;

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
    const [docType, setDocType] = useState('single'); // 'single' | 'twocol'
    const [smartPasteFeedback, setSmartPasteFeedback] = useState(''); // toast message

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
    // Returns ARRAY of page HTML strings
    const finalPages = useMemo(() => {
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

    // -----------------------------------------------------------------
    // Smart Paste: auto-split HTML + JSON from combined AI output
    // -----------------------------------------------------------------
    const smartSplitContent = (rawText) => {
        if (!rawText || !rawText.trim()) return;
        let text = rawText.trim();
        // Remove markdown code fences
        text = text.replace(/```html\s*/gi, '\n---HTML_SPLIT---\n').replace(/```json\s*/gi, '\n---JSON_SPLIT---\n').replace(/```/g, '\n---END_BLOCK---\n');

        let htmlPart = '';
        let jsonPart = '';

        // Strategy 1: If we have clear markers from stripping code fences
        if (text.includes('---HTML_SPLIT---') || text.includes('---JSON_SPLIT---')) {
            const blocks = text.split(/---(?:HTML_SPLIT|JSON_SPLIT|END_BLOCK)---/).map(b => b.trim()).filter(Boolean);
            for (const block of blocks) {
                if (block.match(/^\s*[{\[]/) && block.match(/[}\]]\s*$/)) {
                    if (!jsonPart) jsonPart = block;
                } else if (block.includes('<')) {
                    if (!htmlPart) htmlPart = block;
                }
            }
        }

        // Strategy 2: Find JSON object { ... } and HTML by elimination
        if (!jsonPart || !htmlPart) {
            // Try to find a top-level JSON object
            const jsonMatch = text.match(/(\{[\s\S]*\})/); 
            if (jsonMatch) {
                try {
                    JSON.parse(jsonMatch[1]);
                    jsonPart = jsonMatch[1];
                    // Everything else that has HTML tags is HTML
                    const remaining = text.replace(jsonMatch[1], '').trim();
                    if (remaining.includes('<') && !htmlPart) {
                        htmlPart = remaining.replace(/```\w*/g, '').replace(/```/g, '').trim();
                    }
                } catch (e) { /* not valid JSON, skip */ }
            }
        }

        // Strategy 3: HTML detection by tag presence
        if (!htmlPart && text.includes('<div') || text.includes('<table') || text.includes('<ol')) {
            // Extract the HTML portion (everything from first < to matching structure)
            const htmlMatch = text.match(/(<(?:div|table|section|header|ol|ul|h[1-6])[\s\S]*>)/i);
            if (htmlMatch) htmlPart = htmlMatch[0];
        }

        if (htmlPart || jsonPart) {
            if (htmlPart) setHtmlInput(htmlPart);
            if (jsonPart) setJsonInput(jsonPart);
            const parts = [];
            if (htmlPart) parts.push('HTML');
            if (jsonPart) parts.push('JSON');
            setSmartPasteFeedback(`\u2705 T\u1ef1 \u0111\u1ed9ng t\u00e1ch ${parts.join(' + ')} th\u00e0nh c\u00f4ng!`);
            setTimeout(() => setSmartPasteFeedback(''), 3000);
        } else {
            setSmartPasteFeedback('\u26a0\ufe0f Kh\u00f4ng nh\u1eadn di\u1ec7n \u0111\u01b0\u1ee3c HTML/JSON. H\u00e3y d\u00e1n ri\u00eang v\u00e0o t\u1eebng \u00f4.');
            setTimeout(() => setSmartPasteFeedback(''), 4000);
        }
    };

    // --- DOCX Export (improved walker) ---
    const handleExportDocx = async () => {
        if (!printAreaRef.current) return;
        const allChildren = [];

        const walkNode = (node, ctx = {}) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) return [new TextRun({ text, size: 22, bold: ctx.bold, italics: ctx.italic })];
                return [];
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return [];
            const tag = node.tagName.toLowerCase();
            // Skip page indicators and no-print elements
            if (node.classList && (node.classList.contains('no-print') || node.classList.contains('select-none'))) return [];

            const computed = window.getComputedStyle(node);
            const isBold = ctx.bold || computed.fontWeight >= 600;
            const isItalic = ctx.italic || computed.fontStyle === 'italic';
            const childCtx = { ...ctx, bold: isBold, italic: isItalic };

            // --- 2-column grid → DOCX table with 2 columns ---
            if (tag === 'div' && node.className && typeof node.className === 'string' && node.className.includes('grid-cols-2')) {
                const cols = [...node.children];
                if (cols.length >= 2) {
                    const leftItems = [];
                    const rightItems = [];
                    // Walk each column to get text paragraphs
                    const walkColChildren = (col, target) => {
                        for (const child of col.childNodes) {
                            const runs = walkNode(child, childCtx);
                            if (runs.length > 0) {
                                target.push(new Paragraph({ children: runs, spacing: { after: 40 } }));
                            }
                        }
                    };
                    walkColChildren(cols[0], leftItems);
                    walkColChildren(cols[1], rightItems);
                    if (leftItems.length === 0) leftItems.push(new Paragraph({ text: '' }));
                    if (rightItems.length === 0) rightItems.push(new Paragraph({ text: '' }));
                    allChildren.push(new Table({
                        rows: [new TableRow({
                            children: [
                                new TableCell({ children: leftItems, width: { size: 50, type: WidthType.PERCENTAGE } }),
                                new TableCell({ children: rightItems, width: { size: 50, type: WidthType.PERCENTAGE } }),
                            ],
                        })],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }));
                    allChildren.push(new Paragraph({ text: '', spacing: { after: 120 } }));
                    return [];
                }
            }

            // --- Table ---
            if (tag === 'table') {
                const rows = [];
                node.querySelectorAll('tr').forEach(tr => {
                    const cells = [];
                    tr.querySelectorAll('td, th').forEach(cell => {
                        const cellBold = cell.tagName === 'TH' || window.getComputedStyle(cell).fontWeight >= 600;
                        cells.push(new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: cell.textContent.trim(), bold: cellBold, size: 20 })] })],
                            width: { size: Math.floor(100 / Math.max(tr.children.length, 1)), type: WidthType.PERCENTAGE },
                        }));
                    });
                    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
                });
                if (rows.length > 0) {
                    allChildren.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
                    allChildren.push(new Paragraph({ text: '', spacing: { after: 120 } }));
                }
                return [];
            }

            // --- Ordered list ---
            if (tag === 'ol') {
                [...node.children].forEach((li, idx) => {
                    if (li.tagName === 'LI') {
                        allChildren.push(new Paragraph({
                            children: [new TextRun({ text: `${idx + 1}. ${li.textContent.trim()}`, size: 22, bold: isBold })],
                            spacing: { after: 40 },
                            indent: { left: 360 },
                        }));
                    }
                });
                return [];
            }

            // --- Unordered list ---
            if (tag === 'ul') {
                [...node.children].forEach(li => {
                    if (li.tagName === 'LI') {
                        allChildren.push(new Paragraph({
                            children: [new TextRun({ text: `\u2022 ${li.textContent.trim()}`, size: 22, bold: isBold })],
                            spacing: { after: 40 },
                            indent: { left: 360 },
                        }));
                    }
                });
                return [];
            }

            // --- Headings ---
            if (tag === 'h1') {
                allChildren.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 32 })],
                    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 },
                }));
                return [];
            }
            if (tag === 'h2') {
                allChildren.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 28 })],
                    heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 },
                }));
                return [];
            }
            if (tag === 'h3' || tag === 'h4') {
                allChildren.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_3, spacing: { before: 120, after: 80 },
                }));
                return [];
            }

            // --- Leaf div/p/span with text ---
            const childRuns = [];
            for (const child of node.childNodes) childRuns.push(...walkNode(child, childCtx));

            if ((tag === 'p' || tag === 'div' || tag === 'span') && childRuns.length > 0) {
                const hasBlockChildren = [...node.children].some(c => ['DIV', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'P', 'OL', 'UL'].includes(c.tagName));
                if (!hasBlockChildren && node.textContent.trim()) {
                    allChildren.push(new Paragraph({
                        children: [new TextRun({ text: node.textContent.trim(), bold: isBold, italics: isItalic, size: 22 })],
                        spacing: { after: 60 },
                    }));
                    return [];
                }
            }

            // --- Bold / Italic inline ---
            if (tag === 'b' || tag === 'strong') return [new TextRun({ text: node.textContent.trim(), bold: true, size: 22 })];
            if (tag === 'i' || tag === 'em') return [new TextRun({ text: node.textContent.trim(), italics: true, size: 22 })];
            if (tag === 'li') return [new TextRun({ text: node.textContent.trim(), size: 22, bold: isBold })];

            return childRuns;
        };

        // Walk ALL .print-target elements (multi-page)
        const printTargets = printAreaRef.current.querySelectorAll('.print-target');
        if (printTargets.length > 0) {
            printTargets.forEach((target, idx) => {
                if (idx > 0) allChildren.push(new Paragraph({ text: '', spacing: { before: 400, after: 200 }, border: { bottom: { style: 'single', size: 1, color: 'cccccc' } } }));
                for (const child of target.childNodes) walkNode(child, {});
            });
        } else {
            for (const child of printAreaRef.current.childNodes) walkNode(child, {});
        }

        if (allChildren.length === 0) {
            allChildren.push(new Paragraph({ children: [new TextRun({ text: printAreaRef.current.textContent.trim() || 'No content', size: 22 })] }));
        }

        const doc = new Document({ sections: [{ children: allChildren }] });
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
        /* Fix: neutralize nested w-[210mm] from AI output */
        .page-content-wrapper * {
          box-sizing: border-box !important;
          max-width: 100% !important;
        }
        .page-content-wrapper > div {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          min-height: auto !important;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .min-h-screen { min-height: 0 !important; }
          .print-target {
            position: relative !important;
            width: 210mm !important;
            ${isHeightTrimmed ? 'height: auto !important; min-height: auto !important;' : 'height: 297mm !important; min-height: 297mm !important;'}
            margin: 0 !important;
            padding: 12mm !important;
            box-shadow: none !important;
            border: none !important;
            background-color: white !important;
            overflow: hidden !important;
            page-break-after: always;
          }
          .print-target:last-child {
            page-break-after: auto;
          }
          .print-target * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Reset zoom transform */
          [style*="transform"] {
            transform: none !important;
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

                        {/* Document Type Toggle */}
                        <div className="flex gap-1 p-1 mx-4 mt-2 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setDocType('single')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${docType === 'single' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                📄 Biểu mẫu đơn
                            </button>
                            <button
                                onClick={() => setDocType('twocol')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${docType === 'twocol' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                📰 Văn bản 2 cột
                            </button>
                        </div>

                        {/* Prompt Helpers */}
                        {promptSource === 'gemini' ? (
                            <>
                                <PromptHelper title={docType === 'twocol' ? '🏗️ Lệnh AI Vẽ HTML 2 Cột' : 'Lệnh AI Vẽ HTML Template'} promptText={docType === 'twocol' ? TWO_COL_HTML_PROMPT : htmlPromptText} />
                                <PromptHelper title={docType === 'twocol' ? '📊 Lệnh AI Trích Xuất JSON 2 Cột' : 'Lệnh AI Trích Xuất JSON'} promptText={docType === 'twocol' ? TWO_COL_JSON_PROMPT : jsonPromptText} />
                            </>
                        ) : (
                            <PromptHelper title={docType === 'twocol' ? '📓 NotebookLM — Văn bản 2 Cột' : 'Hướng dẫn NotebookLM (HTML + JSON)'} promptText={docType === 'twocol' ? TWO_COL_NOTEBOOKLM_PROMPT : TEMPLATE_NOTEBOOKLM_PROMPT} />
                        )}

                        {/* Smart Paste + HTML/JSON Inputs */}
                        <div className="p-4 space-y-3">
                            {/* Smart Paste */}
                            <div className="p-3 bg-gradient-to-r from-amber-50 to-fuchsia-50 border border-amber-200 rounded-xl space-y-2">
                                <label className="text-xs font-bold text-amber-700 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Wand2 size={13} /> Smart Paste (Dán tất cả vào đây)
                                </label>
                                <textarea
                                    className="w-full h-20 p-2.5 bg-white border border-amber-200 text-slate-700 font-mono text-[10px] leading-relaxed rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                                    placeholder="Dán toàn bộ output từ NotebookLM/Gemini vào đây (gồm cả HTML + JSON) — hệ thống sẽ tự tách..."
                                    onPaste={(e) => {
                                        setTimeout(() => {
                                            const val = e.target.value;
                                            smartSplitContent(val);
                                            e.target.value = '';
                                        }, 50);
                                    }}
                                    onChange={() => {}}
                                />
                                {smartPasteFeedback && (
                                    <div className={`text-[10px] font-bold px-2 py-1 rounded ${smartPasteFeedback.startsWith('\u2705') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {smartPasteFeedback}
                                    </div>
                                )}
                            </div>

                            {/* HTML Template Input */}
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
                                className="w-full h-32 p-3 bg-[#1E1E1E] text-blue-300 font-mono text-[10px] leading-relaxed rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none shadow-inner"
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
                                className={`w-full h-28 p-3 bg-[#1E1E1E] text-emerald-300 font-mono text-[10px] leading-relaxed rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none shadow-inner ${jsonError ? 'ring-2 ring-red-500' : ''}`}
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

                    {/* Document Canvas — Multi-page */}
                    <div ref={printAreaRef} className="flex flex-col gap-10 pb-24 items-center w-full" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                        {finalPages.map((pageHtml, pageIdx) => (
                            <div
                                key={pageIdx}
                                className={`bg-white shadow-2xl transition-all print-target outline-none relative 
                                ${['text-[9px]', 'text-[10px]', 'text-[11px]', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'][bodyFontSizeIndex]}
                                ${isEditing ? 'ring-4 ring-amber-400 border-amber-500' : ''}
                                ${customFont ? 'custom-font-active' : ''}`}
                                style={{
                                    width: '210mm',
                                    minHeight: isHeightTrimmed ? 'auto' : '297mm',
                                    padding: '12mm',
                                    boxSizing: 'border-box',
                                    overflow: 'hidden',
                                    ...(customFont ? { '--custom-font': customFont, fontFamily: customFont } : {}),
                                }}
                                contentEditable={isEditing}
                                suppressContentEditableWarning={true}
                                onClick={handlePreviewClick}
                            >
                                {/* Page indicator */}
                                {finalPages.length > 1 && (
                                    <div className="absolute top-2 right-3 text-[9px] font-bold text-slate-300 no-print select-none">
                                        {pageIdx + 1} / {finalPages.length}
                                    </div>
                                )}
                                {/* Inner Scaling + Content Wrapper */}
                                <div
                                    className="page-content-wrapper"
                                    style={{
                                        transform: `scale(${contentScale})`,
                                        transformOrigin: 'top left',
                                        width: `${100 / contentScale}%`,
                                        ...(isHeightTrimmed ? {} : { minHeight: `${100 / contentScale}%` })
                                    }}
                                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                                />
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </>
    );
};

export default TemplateOverlayView;
