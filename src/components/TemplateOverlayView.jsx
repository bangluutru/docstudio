import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    ChevronDown,
    ChevronRight,
    PlusCircle,
    Trash2,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import DocToolbar from './DocToolbar';
import { UNIFIED_TEMPLATE_GEMINI_PROMPT, UNIFIED_TEMPLATE_NOTEBOOKLM_PROMPT } from '../utils/prompts';

// localStorage key for Tab 4 pages persistence
const TAB4_STORAGE_KEY = 'docstudio_tab4_pages_v1';

// Helper: extract page title from JSON data
const extractPageTitle = (jsonStr, index) => {
    try {
        if (!jsonStr) return `Trang ${index + 1}`;
        const data = JSON.parse(jsonStr);
        // Try common title keys
        for (const key of ['title', 'heading', 'header', 'doc_title']) {
            if (data[key]) {
                const val = typeof data[key] === 'object' ? (data[key].vn || data[key].en || data[key].jp) : data[key];
                if (val) return val.length > 30 ? val.substring(0, 30) + '\u2026' : val;
            }
        }
        // Fallback: first key's value
        const firstKey = Object.keys(data)[0];
        if (firstKey && data[firstKey]) {
            const val = typeof data[firstKey] === 'object' ? (data[firstKey].vn || data[firstKey].en || data[firstKey].jp) : data[firstKey];
            if (val) return val.length > 30 ? val.substring(0, 30) + '\u2026' : val;
        }
    } catch {}
    return `Trang ${index + 1}`;
};

// =====================================================================
// Sanitize AI HTML: strip outer wrapper + auto-compact spacing
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

    // Auto-compact: reduce large spacing to tighter values
    // Map: p-8→p-3, p-10→p-3, p-12→p-4, mb-8→mb-2, mb-6→mb-2, gap-6→gap-2, py-8→py-2, etc.
    const spacingScale = ['0','0.5','1','1.5','2','2.5','3','3.5','4','5','6','7','8','9','10','11','12','14','16','20','24','28','32','36','40','44','48','52','56','60','64','72','80','96'];
    clean = clean.replace(/\b([mp][tbyxlr]?-|gap-)(\d+|1\.5|2\.5|3\.5)(?![a-zA-Z0-9_\[.-])/g, (match, prefix, val) => {
        const idx = spacingScale.indexOf(val);
        // Compact values >= index 8 (which is '5') down by ~half
        if (idx >= 8) {
            const newIdx = Math.max(4, Math.floor(idx * 0.5));
            return prefix + spacingScale[newIdx];
        }
        return match;
    });
    // Also compact arbitrary px spacing: [40px]→[12px], [60px]→[16px], etc.
    clean = clean.replace(/\b([mp][tbyxlr]?-|gap-)\[(\d+)px\]/g, (match, prefix, val) => {
        const px = parseInt(val, 10);
        if (px > 24) return `${prefix}[${Math.max(8, Math.round(px * 0.35))}px]`;
        return match;
    });
    // Strip shadow classes (cosmetic, causes visual artifacts in print)
    clean = clean.replace(/\bshadow(-[a-zA-Z0-9]+)?\b/g, '').replace(/\s{2,}/g, ' ');

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
    const [showJsonInput, setShowJsonInput] = useState(false);
    const [smartPasteMsg, setSmartPasteMsg] = useState('');
    const [autoPaginatedPages, setAutoPaginatedPages] = useState(null);
    const measureRef = useRef(null);

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
    const [appendMode, setAppendMode] = useState(false);
    const [pages, setPages] = useState(() => {
        try {
            const stored = localStorage.getItem(TAB4_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    const [jsonError, setJsonError] = useState('');

    // Print ref
    const printAreaRef = useRef(null);

    // Save pages to localStorage (like Tab 1's saveBlocks)
    const savePages = useCallback((newPages) => {
        setPages(newPages);
        try {
            localStorage.setItem(TAB4_STORAGE_KEY, JSON.stringify(newPages));
        } catch (e) {
            console.error('localStorage save error:', e);
        }
    }, []);

    // -----------------------------------------------------------------
    // EFFECTIVE HTML/JSON: combined from pages array OR textarea
    // -----------------------------------------------------------------
    const effectiveHtml = useMemo(() => {
        if (pages.length > 0) {
            return pages.map(p => p.html).join('\n<!-- PAGE BREAK -->\n');
        }
        return htmlInput;
    }, [pages, htmlInput]);

    const effectiveJson = useMemo(() => {
        if (pages.length > 0) {
            try {
                const merged = pages.reduce((acc, p) => {
                    if (p.json) {
                        try { return { ...acc, ...JSON.parse(p.json) }; } catch { return acc; }
                    }
                    return acc;
                }, {});
                return JSON.stringify(merged, null, 2);
            } catch { return ''; }
        }
        return jsonInput;
    }, [pages, jsonInput]);

    // -----------------------------------------------------------------
    // EFFECT: Parse JSON
    // -----------------------------------------------------------------
    useEffect(() => {
        try {
            const src = pages.length > 0 ? effectiveJson : jsonInput;
            if (!src.trim()) { setParsedData({}); setJsonError(''); return; }
            const obj = JSON.parse(src);
            setParsedData(obj);
            setJsonError('');
        } catch (err) {
            setJsonError('JSON không hợp lệ: ' + err.message);
        }
    }, [jsonInput, effectiveJson, pages]);

    // -----------------------------------------------------------------
    // RENDER: Interpolate HTML
    // -----------------------------------------------------------------
    // Interpolated pages from HTML template
    const templatePages = useMemo(
        () => interpolateHTML(effectiveHtml, parsedData, currentLang),
        [effectiveHtml, parsedData, currentLang]
    );

    // The final pages to display — auto-paginated if available, otherwise template pages
    const finalPages = autoPaginatedPages || templatePages;

    // -----------------------------------------------------------------
    // AUTO-PAGINATION: measure rendered content and split into A4 pages
    // -----------------------------------------------------------------
    const A4_CONTENT_HEIGHT_PX = 1032; // ~273mm content area (297mm - 12mm top - 15mm bottom) at 96dpi

    useEffect(() => {
        // Only auto-paginate single-page content that might overflow
        if (templatePages.length > 1 || !templatePages[0]) {
            setAutoPaginatedPages(null);
            return;
        }

        // Use setTimeout to wait for Tailwind CDN to process classes
        const timerId = setTimeout(() => {
            const container = measureRef.current;
            if (!container) return;

            const totalHeight = container.scrollHeight;
            if (totalHeight <= A4_CONTENT_HEIGHT_PX) {
                setAutoPaginatedPages(null); // fits in one page
                return;
            }

            // Recursively find splittable block-level children
            // AI often wraps everything in a single div — we need to unwrap
            const findSplittableChildren = (el) => {
                const kids = [...el.children];
                // If only 1 child and it's a div wrapper, go deeper
                if (kids.length === 1 && kids[0].tagName === 'DIV' && kids[0].children.length > 1) {
                    return findSplittableChildren(kids[0]);
                }
                return kids.length > 0 ? kids : [...el.childNodes].filter(n => n.nodeType === Node.ELEMENT_NODE);
            };

            const children = findSplittableChildren(container);
            if (children.length <= 1) {
                setAutoPaginatedPages(null);
                return;
            }

            const pages = [];
            let currentPageHtml = [];
            let currentHeight = 0;

            for (const child of children) {
                const style = getComputedStyle(child);
                const marginTop = parseInt(style.marginTop) || 0;
                const marginBottom = parseInt(style.marginBottom) || 0;
                const childHeight = child.offsetHeight + marginTop + marginBottom;

                if (currentHeight + childHeight > A4_CONTENT_HEIGHT_PX && currentPageHtml.length > 0) {
                    // Start new page
                    pages.push(currentPageHtml.join('\n'));
                    currentPageHtml = [child.outerHTML];
                    currentHeight = childHeight;
                } else {
                    currentPageHtml.push(child.outerHTML);
                    currentHeight += childHeight;
                }
            }

            // Push remaining
            if (currentPageHtml.length > 0) {
                pages.push(currentPageHtml.join('\n'));
            }

            if (pages.length > 1) {
                setAutoPaginatedPages(pages);
            } else {
                setAutoPaginatedPages(null);
            }
        }, 300); // Wait for Tailwind CDN to process

        return () => clearTimeout(timerId);
    }, [templatePages]);

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
    // Smart auto-split: detect HTML+JSON in pasted content
    // -----------------------------------------------------------------
    const handleHtmlPaste = (e) => {
        const pasted = e.clipboardData.getData('text');
        if (!pasted || !pasted.trim()) return;

        const text = pasted.trim();

        // Helper: strip markdown code fences
        const stripCodeFence = (str) => {
            return str.replace(/^```(?:html|json|css|javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        };

        // Helper: show success message
        const showSuccess = (msg) => {
            setSmartPasteMsg(msg || '\u2705 T\u1ef1 \u0111\u1ed9ng t\u00e1ch HTML + JSON th\u00e0nh c\u00f4ng!');
            setTimeout(() => setSmartPasteMsg(''), 3000);
        };

        // Helper: apply HTML+JSON (respects append mode)
        const applyResult = (htmlPart, jsonPart) => {
            if (appendMode) {
                // Append mode: add as new page, clear textarea for next input
                const newPage = { html: htmlPart || '', json: jsonPart || '' };
                const currentPages = pages;
                let updated;
                if (currentPages.length === 0 && htmlInput.trim()) {
                    updated = [{ html: htmlInput.trim(), json: jsonInput.trim() }, newPage];
                } else {
                    updated = [...currentPages, newPage];
                }
                savePages(updated);
                setHtmlInput('');
                setJsonInput('');
            } else {
                // Normal mode: replace directly
                if (htmlPart) setHtmlInput(htmlPart);
                if (jsonPart) { setJsonInput(jsonPart); setShowJsonInput(true); }
                savePages([]);
            }
        };

        // ── Strategy 1: Explicit ---JSON_DATA--- marker (Gemini) ──
        const markerIdx = text.indexOf('---JSON_DATA---');
        if (markerIdx >= 0) {
            e.preventDefault();
            applyResult(
                stripCodeFence(text.substring(0, markerIdx)),
                stripCodeFence(text.substring(markerIdx + '---JSON_DATA---'.length))
            );
            showSuccess(appendMode ? '\u2705 \u0110\u00e3 n\u1ed1i th\u00eam trang!' : undefined);
            return;
        }

        // ── Strategy 2: Markdown code blocks (NotebookLM) ──
        const htmlBlockMatch = text.match(/```html\s*\n([\s\S]*?)```/i);
        const jsonBlockMatch = text.match(/```json\s*\n([\s\S]*?)```/i);

        if (htmlBlockMatch) {
            e.preventDefault();
            applyResult(htmlBlockMatch[1].trim(), jsonBlockMatch ? jsonBlockMatch[1].trim() : null);
            showSuccess(appendMode ? '\u2705 \u0110\u00e3 n\u1ed1i th\u00eam trang!' : (jsonBlockMatch ? undefined : '\u2705 \u0110\u00e3 nh\u1eadn HTML!'));
            return;
        }

        // ── Strategy 3: Raw HTML + JSON mixed (auto-detect) ──
        const hasHtmlTags = /<(?:div|table|section|h[1-6]|ol|ul|p|span)[\s>]/i.test(text);
        const hasJsonBlock = /\{[\s\S]*"vn"\s*:/i.test(text);

        if (hasHtmlTags && hasJsonBlock) {
            // Method A: line-by-line from bottom (works when JSON is cleanly separated)
            let jsonStart = -1;
            const lines = text.split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                const trimmed = lines[i].trim();
                if (trimmed === '{' || trimmed.startsWith('{')) {
                    const candidate = lines.slice(i).join('\n').trim();
                    try {
                        const parsed = JSON.parse(candidate);
                        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                            jsonStart = i;
                            break;
                        }
                    } catch (_) { /* keep searching */ }
                }
            }

            if (jsonStart >= 0) {
                e.preventDefault();
                applyResult(lines.slice(0, jsonStart).join('\n').trim(), lines.slice(jsonStart).join('\n').trim());
                showSuccess(appendMode ? '\u2705 \u0110\u00e3 n\u1ed1i th\u00eam trang!' : undefined);
                return;
            }

            // Method B: bracket-match extraction (works when NLM adds trailing text after JSON)
            const lastBrace = text.lastIndexOf('}');
            if (lastBrace > 0) {
                let depth = 0;
                let jsonStartIdx = -1;
                for (let i = lastBrace; i >= 0; i--) {
                    if (text[i] === '}') depth++;
                    if (text[i] === '{') depth--;
                    if (depth === 0) { jsonStartIdx = i; break; }
                }
                if (jsonStartIdx > 0) {
                    const jsonCandidate = text.substring(jsonStartIdx, lastBrace + 1);
                    try {
                        const parsed = JSON.parse(jsonCandidate);
                        if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
                            e.preventDefault();
                            const htmlPart = text.substring(0, jsonStartIdx).replace(/```json\s*$/i, '').replace(/```\s*$/i, '').trim();
                            applyResult(stripCodeFence(htmlPart), jsonCandidate);
                            showSuccess(appendMode ? '\u2705 \u0110\u00e3 n\u1ed1i th\u00eam trang!' : undefined);
                            return;
                        }
                    } catch (_) { /* not valid JSON, fall through */ }
                }
            }
        }

        // ── Strategy 4: Plain HTML ──
        if (hasHtmlTags) {
            e.preventDefault();
            applyResult(text, null);
            showSuccess(appendMode ? '\u2705 \u0110\u00e3 n\u1ed1i th\u00eam trang!' : '\u2705 \u0110\u00e3 nh\u1eadn HTML!');
            return;
        }
        // Otherwise: default textarea paste
    };

    // -----------------------------------------------------------------
    // APPEND PAGE: add new page content to existing document
    // -----------------------------------------------------------------
    const handleAppendPage = (newHtml, newJson) => {
        if (!newHtml && !newJson) return;
        const newPage = { html: newHtml || '', json: newJson || '' };
        const currentPages = pages;
        let updated;
        if (currentPages.length === 0 && htmlInput.trim()) {
            updated = [{ html: htmlInput.trim(), json: jsonInput.trim() }, newPage];
        } else {
            updated = [...currentPages, newPage];
        }
        savePages(updated);
        setHtmlInput('');
        setJsonInput('');
        setSmartPasteMsg('\u2705 \u0110\u00e3 n\u1ed1i th\u00eam trang m\u1edbi!');
        setTimeout(() => setSmartPasteMsg(''), 3000);
    };

    // -----------------------------------------------------------------
    // DELETE A SPECIFIC PAGE
    // -----------------------------------------------------------------
    const handleDeletePage = (index) => {
        const updated = pages.filter((_, i) => i !== index);
        if (updated.length === 1) {
            setHtmlInput(updated[0].html);
            setJsonInput(updated[0].json);
            if (updated[0].json) setShowJsonInput(true);
            savePages([]);
        } else if (updated.length === 0) {
            setHtmlInput('');
            setJsonInput('');
            savePages([]);
        } else {
            savePages(updated);
        }
    };

    // -----------------------------------------------------------------
    // CLEAR ALL: reset HTML + JSON + pages
    // -----------------------------------------------------------------
    const handleClear = () => {
        if (pages.length > 0 || htmlInput.trim()) {
            if (!window.confirm('Xoá toàn bộ dữ liệu (tất cả các trang)?')) return;
        }
        setHtmlInput('');
        setJsonInput('');
        setParsedData({});
        setAutoPaginatedPages(null);
        setSmartPasteMsg('');
        savePages([]);
    };


    // -----------------------------------------------------------------
    // PRINT ACTION & MANUAL EDIT
    // -----------------------------------------------------------------
    const handlePrint = () => {
        if (!printAreaRef.current) return;
        // Collect all rendered page HTML
        const printPages = printAreaRef.current.querySelectorAll('.print-target');
        if (printPages.length === 0) return;

        // Map bodyFontSizeIndex to actual CSS font sizes
        const fontSizes = ['9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px', '60px'];
        const fontSize = fontSizes[bodyFontSizeIndex] || '14px';

        let pagesHtml = '';
        printPages.forEach((page, idx) => {
            // Get the inner content wrapper
            const wrapper = page.querySelector('.page-content-wrapper');
            const content = wrapper ? wrapper.innerHTML : page.innerHTML;
            // Apply contentScale to the content wrapper inside each page
            const scaleStyle = contentScale !== 1
                ? `transform:scale(${contentScale});transform-origin:top left;width:${100 / contentScale}%;`
                : '';
            pagesHtml += `<div style="width:210mm;min-height:297mm;padding:12mm 12mm 15mm 12mm;box-sizing:border-box;overflow:hidden;background:white;position:relative;font-size:${fontSize};${idx < printPages.length - 1 ? 'page-break-after:always;' : ''}">
                <div style="${scaleStyle}">${content}</div>
            </div>`;
        });

        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (!printWindow) { alert('Popup bị chặn. Vui lòng cho phép popup để in PDF.'); return; }
        printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>DocStudio - Print</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; padding: 0; background: white; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  ${customFont ? `* { font-family: ${customFont} !important; }` : ''}
</style>
</head><body>
${pagesHtml}
<script>
  // Wait for Tailwind to process, then print
  setTimeout(() => { window.print(); window.close(); }, 800);
<\/script>
</body></html>`);
        printWindow.document.close();
    };

    // --- DOCX Export (proper .docx using docx library) ---
    const handleExportDocx = async () => {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak } = await import('docx');
        if (!printAreaRef.current) return;
        const allChildren = [];

        // Detect alignment from className
        const getAlignment = (node) => {
            const cls = node.className || '';
            if (typeof cls === 'string') {
                if (cls.includes('text-center')) return AlignmentType.CENTER;
                if (cls.includes('text-right')) return AlignmentType.RIGHT;
            }
            return undefined;
        };

        // Border preset for table cells
        const cellBorders = {
            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        };
        const noBorders = {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
        };

        // Red border for banned/warning sections
        const redBorders = {
            top: { style: BorderStyle.SINGLE, size: 3, color: 'DC2626' },
            bottom: { style: BorderStyle.SINGLE, size: 3, color: 'DC2626' },
            left: { style: BorderStyle.SINGLE, size: 3, color: 'DC2626' },
            right: { style: BorderStyle.SINGLE, size: 3, color: 'DC2626' },
        };

        // Recursive walker that returns an array of docx children (Paragraphs, Tables)
        const walkChildren = (parentNode, ctx = {}) => {
            const result = [];
            for (const node of parentNode.childNodes) {
                walkNode(node, ctx, result);
            }
            return result;
        };

        const walkNode = (node, ctx = {}, target) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    target.push(new Paragraph({
                        children: [new TextRun({ text, size: 22, bold: ctx.bold, italics: ctx.italic })],
                        spacing: { after: 40 },
                        alignment: ctx.alignment,
                    }));
                }
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toLowerCase();

            // Skip no-print / select-none
            if (node.classList && (node.classList.contains('no-print') || node.classList.contains('select-none'))) return;

            const computed = window.getComputedStyle(node);
            const isBold = ctx.bold || computed.fontWeight >= 600;
            const isItalic = ctx.italic || computed.fontStyle === 'italic';
            const alignment = getAlignment(node) || ctx.alignment;
            const childCtx = { ...ctx, bold: isBold, italic: isItalic, alignment };

            // --- 2-column grid → table with 2 columns ---
            if (tag === 'div' && node.className && typeof node.className === 'string' && node.className.includes('grid-cols-2')) {
                const cols = [...node.children];
                if (cols.length >= 2) {
                    const leftItems = walkChildren(cols[0], childCtx);
                    const rightItems = walkChildren(cols[1], childCtx);
                    if (leftItems.length === 0) leftItems.push(new Paragraph({ text: '' }));
                    if (rightItems.length === 0) rightItems.push(new Paragraph({ text: '' }));
                    target.push(new Table({
                        rows: [new TableRow({
                            children: [
                                new TableCell({ children: leftItems, width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders }),
                                new TableCell({ children: rightItems, width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders }),
                            ],
                        })],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }));
                    return;
                }
            }

            // --- Red-bordered div (e.g., banned section) → single-cell table with red border ---
            if (tag === 'div' && node.className && typeof node.className === 'string' &&
                (node.className.includes('border-red') || node.className.includes('border-2'))) {
                const innerChildren = walkChildren(node, childCtx);
                if (innerChildren.length > 0) {
                    target.push(new Table({
                        rows: [new TableRow({
                            children: [
                                new TableCell({ children: innerChildren, borders: redBorders, width: { size: 100, type: WidthType.PERCENTAGE } }),
                            ],
                        })],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }));
                    target.push(new Paragraph({ text: '', spacing: { after: 80 } }));
                    return;
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
                            children: [new Paragraph({
                                children: [new TextRun({ text: cell.textContent.trim(), bold: cellBold, size: 20 })],
                                alignment: getAlignment(cell),
                            })],
                            width: { size: Math.floor(100 / Math.max(tr.children.length, 1)), type: WidthType.PERCENTAGE },
                            borders: cellBorders,
                        }));
                    });
                    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
                });
                if (rows.length > 0) {
                    target.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
                    target.push(new Paragraph({ text: '', spacing: { after: 80 } }));
                }
                return;
            }

            // --- Ordered list ---
            if (tag === 'ol') {
                const startNum = parseInt(node.getAttribute('start')) || 1;
                [...node.children].forEach((li, idx) => {
                    if (li.tagName === 'LI') {
                        target.push(new Paragraph({
                            children: [new TextRun({ text: `${startNum + idx}. ${li.textContent.trim()}`, size: 22, bold: isBold })],
                            spacing: { after: 40 },
                            indent: { left: 360 },
                        }));
                    }
                });
                return;
            }

            // --- Unordered list ---
            if (tag === 'ul') {
                [...node.children].forEach(li => {
                    if (li.tagName === 'LI') {
                        target.push(new Paragraph({
                            children: [new TextRun({ text: `\u2022 ${li.textContent.trim()}`, size: 22, bold: isBold })],
                            spacing: { after: 40 },
                            indent: { left: 360 },
                        }));
                    }
                });
                return;
            }

            // --- Headings ---
            if (tag === 'h1') {
                target.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 32 })],
                    heading: HeadingLevel.HEADING_1, alignment: alignment || AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 },
                }));
                return;
            }
            if (tag === 'h2') {
                target.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 28 })],
                    heading: HeadingLevel.HEADING_2, alignment,
                    spacing: { before: 160, after: 120 },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' } },
                }));
                return;
            }
            if (tag === 'h3' || tag === 'h4') {
                target.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_3, alignment,
                    spacing: { before: 120, after: 80 },
                }));
                return;
            }

            // --- Div/P/Span: check if leaf (no block children) → emit paragraph ---
            if (tag === 'p' || tag === 'div' || tag === 'span') {
                const hasBlockChildren = [...node.children].some(c =>
                    ['DIV', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'P', 'OL', 'UL'].includes(c.tagName)
                );
                if (!hasBlockChildren && node.textContent.trim()) {
                    target.push(new Paragraph({
                        children: [new TextRun({ text: node.textContent.trim(), bold: isBold, italics: isItalic, size: 22 })],
                        spacing: { after: 60 },
                        alignment,
                    }));
                    return;
                }
            }

            // --- Bold / Italic inline ---
            if (tag === 'b' || tag === 'strong') {
                target.push(new Paragraph({
                    children: [new TextRun({ text: node.textContent.trim(), bold: true, size: 22 })],
                    spacing: { after: 40 },
                }));
                return;
            }

            // --- Recurse into children ---
            for (const child of node.childNodes) walkNode(child, childCtx, target);
        };

        // Walk ALL .print-target elements (multi-page)
        const printTargets = printAreaRef.current.querySelectorAll('.print-target');
        if (printTargets.length > 0) {
            printTargets.forEach((target, idx) => {
                const wrapper = target.querySelector('.page-content-wrapper') || target;
                walkChildren(wrapper, {}).forEach(child => allChildren.push(child));
                // Add page break between pages
                if (idx < printTargets.length - 1) {
                    allChildren.push(new Paragraph({ children: [new PageBreak()] }));
                }
            });
        }

        if (allChildren.length === 0) {
            allChildren.push(new Paragraph({ children: [new TextRun({ text: 'No content', size: 22 })] }));
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
            {/* Hidden measuring container for auto-pagination */}
            {templatePages.length === 1 && templatePages[0] && (
                <div
                    ref={measureRef}
                    style={{
                        position: 'absolute',
                        width: 'calc(210mm - 24mm)', /* A4 width minus left+right padding */
                        clip: 'rect(0, 0, 0, 0)',
                        clipPath: 'inset(50%)',
                        overflow: 'hidden',
                        whiteSpace: 'normal',
                        height: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: templatePages[0] }}
                />
            )}

            {/* Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
        /* Fix: neutralize nested w-[210mm] from AI output */
        .page-content-wrapper * {
          box-sizing: border-box !important;
          max-width: 100% !important;
        }
        /* Only strip sizing on the DIRECT outer AI wrapper — preserve table/content borders */
        .page-content-wrapper > div:first-child:last-child {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          min-height: auto !important;
        }
        /* Ensure table borders always visible */
        .page-content-wrapper table,
        .page-content-wrapper td,
        .page-content-wrapper th {
          border-color: inherit !important;
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
                            Universal Document Builder
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
                            <PromptHelper title='📐 Lệnh AI: Vẽ HTML + Trích Xuất JSON' promptText={UNIFIED_TEMPLATE_GEMINI_PROMPT} />
                        ) : (
                            <PromptHelper title='📓 Hướng dẫn NotebookLM' promptText={UNIFIED_TEMPLATE_NOTEBOOKLM_PROMPT} />
                        )}

                        {/* HTML Input */}
                        <div className="p-4 space-y-3">
                            {/* HTML Template Input */}
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Code size={13} /> Dán HTML vào đây
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
                                className="w-full h-52 p-3 bg-[#1E1E1E] text-blue-300 font-mono text-[10px] leading-relaxed rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none shadow-inner"
                                value={htmlInput}
                                onChange={(e) => setHtmlInput(e.target.value)}
                                onPaste={handleHtmlPaste}
                                spellCheck="false"
                                placeholder="Dán HTML từ Gemini/NotebookLM vào đây. Nếu có cả JSON, hệ thống sẽ tự tách..."
                            />
                            {smartPasteMsg && (
                                <div className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-700 transition-all">
                                    {smartPasteMsg}
                                </div>
                            )}

                            {/* Page Count */}
                            {pages.length > 0 && (
                                <section className="pt-3 border-t border-slate-100">
                                    <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 flex justify-between items-center">
                                        <span className="text-sm font-medium text-slate-500">Tổng cộng:</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="font-black text-2xl text-slate-800">{pages.length}</span>
                                            <span className="text-xs text-slate-400">trang</span>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Page List with auto-naming */}
                            {pages.length > 0 && (
                                <section className="pt-3 border-t border-slate-100">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">
                                        Danh sách trang
                                    </p>
                                    <div className="space-y-0.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                        {pages.map((page, i) => (
                                            <div key={i} className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 bg-indigo-600 text-white">
                                                    {i + 1}
                                                </div>
                                                <FileText size={11} className="text-slate-400 shrink-0" />
                                                <span className="text-[11px] font-medium text-slate-600 truncate flex-1">
                                                    {extractPageTitle(page.json, i)}
                                                </span>
                                                <button
                                                    onClick={() => handleDeletePage(i)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                                                    title={`Xoá trang ${i + 1}`}
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Action Buttons: Append Mode Toggle + Clear All */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAppendMode(!appendMode)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                        appendMode
                                            ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-sm'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                    }`}
                                    title={appendMode ? 'Chế độ nối trang: BẬT' : 'Chế độ nối trang: TẮT'}
                                >
                                    <PlusCircle size={13} /> {appendMode ? `🔗 Nối trang: BẬT` : 'Nối trang'}
                                </button>
                            </div>

                            {/* Clear All Button (shown when has data) */}
                            {(pages.length > 0 || htmlInput.trim()) && (
                                <div className="pt-3 border-t border-slate-100">
                                    <button
                                        onClick={handleClear}
                                        className="w-full py-2.5 border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Trash2 size={12} /> Xoá toàn bộ dữ liệu
                                    </button>
                                </div>
                            )}

                            {/* Collapsible JSON Input (for multilingual mode) */}
                            <button
                                onClick={() => setShowJsonInput(!showJsonInput)}
                                className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wide transition-colors"
                            >
                                {showJsonInput ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                JSON (đa ngôn ngữ) — tuỳ chọn
                            </button>
                            {showJsonInput && (
                                <>
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
                                        placeholder='Dán JSON với định dạng { "vn": "...", "en": "...", "jp": "..." }'
                                    />
                                </>
                            )}

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
                                    padding: '12mm 12mm 15mm 12mm',
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
