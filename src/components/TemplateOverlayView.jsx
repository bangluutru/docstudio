import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Printer,
    FileText,
    Code,
    Languages,
    Maximize2,
    RefreshCw,
    Download,
    Sparkles,
    Copy,
    Check
} from 'lucide-react';

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
3. Chống Tràn Dòng & Xếp Chữ Dọc: Bản dịch tiếng Việt/Anh rất dài. Nếu các chữ dài làm phình to chiều cao ô hoặc phá vỡ bảng, BẮT BUỘC:
   - Ép bẻ từ bằng class "break-words" hoặc "whitespace-pre-wrap".
   - Xếp chữ theo chiều dọc "flex-col" nếu ô có tiêu đề + nội dung nằm ngang quá chật.
   - Dùng class thu nhỏ chữ như "text-[10px]" hoặc "text-xs", "leading-tight".
4. Chỉ cần trả về nội dung bên trong cặp thẻ <div> bọc ngoài cùng.`;

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
    // PRINT ACTION
    // -----------------------------------------------------------------
    const handlePrint = () => {
        window.print();
    };


    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-800">

            {/* HEADER - NO PRINT */}
            <div className="no-print bg-slate-900 border-b border-rose-500/30 p-4 shrink-0 shadow-lg">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-9 h-9 bg-rose-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-rose-500/50 shadow-inner">
                            <Code size={18} className="text-rose-400" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight uppercase">Kiến Tạo Mẫu</h1>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Dynamic HTML Builder</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-xl shadow-lg transition-all ${isEditing ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                        >
                            <FileText size={16} /> {isEditing ? 'Đang Sửa...' : 'Chỉnh Sửa Tay'}
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg transition-all"
                        >
                            <Printer size={16} /> Print / Xuất PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN WORKSPACE */}
            <div className="no-print flex-grow flex flex-col lg:flex-row gap-6 p-4 md:p-6 max-w-[1600px] mx-auto w-full h-[calc(100vh-80px)]">

                {/* LEFT PANEL: HTML Template & JSON Data */}
                <div className="w-full lg:w-1/3 xl:w-2/5 flex flex-col gap-6 shrink-0 h-full">

                    {/* Step 1: HTML Template */}
                    <div className="bg-white p-0 rounded-2xl shadow-sm border border-slate-200 flex-grow flex flex-col min-h-[300px] overflow-hidden">
                        <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <span className="w-5 h-5 bg-white shadow-sm rounded flex items-center justify-center text-slate-700">1</span>
                                HTML Template (Bản vẽ)
                            </h3>
                        </div>
                        <PromptHelper title="Lệnh AI Vẽ HTML Template" promptText={htmlPromptText} />
                        <textarea
                            className="w-full flex-grow p-4 bg-[#1E1E1E] text-blue-300 font-mono text-[11px] leading-relaxed focus:outline-none resize-none"
                            value={htmlInput}
                            onChange={(e) => setHtmlInput(e.target.value)}
                            spellCheck="false"
                            placeholder="Dán mã HTML/Tailwind do Gemini gen vào đây. Các biến dùng {{ten_bien}}..."
                        />
                    </div>

                    {/* Step 2: JSON Data */}
                    <div className="bg-white p-0 rounded-2xl shadow-sm border border-slate-200 flex-grow flex flex-col min-h-[300px] overflow-hidden">
                        <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <span className="w-5 h-5 bg-white shadow-sm rounded flex items-center justify-center text-slate-700">2</span>
                                Dữ Liệu (JSON)
                            </h3>
                            {jsonError && <span className="text-[10px] text-red-500 font-bold bg-red-100 px-2 py-1 rounded truncate max-w-[200px]">{jsonError}</span>}
                        </div>
                        <PromptHelper title="Lệnh AI Trích Xuất JSON" promptText={jsonPromptText} />
                        <textarea
                            className={`w-full flex-grow p-4 bg-[#1E1E1E] text-emerald-300 font-mono text-[11px] leading-relaxed focus:outline-none resize-none ${jsonError ? 'border-2 border-red-500' : ''}`}
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            spellCheck="false"
                            placeholder="Dán JSON từ Gemini với định dạng _vn, _en, _jp..."
                        />
                    </div>

                </div>

                {/* RIGHT PANEL: Live Preview Area */}
                <div className="flex-grow bg-slate-400 rounded-3xl border-4 border-slate-300 overflow-hidden relative shadow-inner flex flex-col max-h-full">
                    {/* Toolbar inner */}
                    <div className="h-12 bg-white/90 backdrop-blur border-b border-slate-300 flex items-center px-4 justify-between shrink-0 z-10">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shadow-sm">3</span>
                                Bản Cầm Tay (Live Preview)
                            </span>
                        </div>
                        <div className="flex gap-2 text-[10px] font-bold">
                            <button
                                onClick={() => setCurrentLang('vn')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${currentLang === 'vn' ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                Tiếng Việt
                            </button>
                            <button
                                onClick={() => setCurrentLang('en')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${currentLang === 'en' ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                English
                            </button>
                            <button
                                onClick={() => setCurrentLang('jp')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${currentLang === 'jp' ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                日本語
                            </button>
                        </div>
                    </div>

                    {/* The Scale Wrapper for Preview */}
                    <div className="flex-grow overflow-auto p-4 md:p-8 flex justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-300/50">
                        {/* THE ACTUAL PAPER TO PRINT */}
                        <div
                            className={`bg-white shadow-2xl transition-all print-target outline-none 
                            [&>div]:max-w-none [&>div]:w-full [&>div]:h-full [&>div]:m-0 [&>div]:p-0 [&>div]:border-none [&>div]:shadow-none
                            ${isEditing ? 'ring-4 ring-amber-400 border-amber-500' : ''}`}
                            style={{
                                width: '210mm',
                                minHeight: '297mm', // strict A4 ratio for preview
                                padding: '12mm', // Internal safe margin
                                transformOrigin: 'top center',
                            }}
                            contentEditable={isEditing}
                            suppressContentEditableWarning={true}
                            dangerouslySetInnerHTML={{ __html: finalHtml }}
                        />
                    </div>
                </div>

            </div>

            {/* =========================================================
                PRINT CSS INJECTION
                ========================================================= */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          @page {
            size: A4;
            margin: 0; /* Remove default browser margins to avoid headers/footers */
          }
          body * {
            visibility: hidden; /* Hide absolutely everything */
          }
          .print-target, .print-target * {
            visibility: visible; /* Show only our target A4 paper */
          }
          .print-target {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            height: 297mm; /* Force exactly 1 A4 page if content fits */
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
            background-color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
            
          /* Ensure Tailwind background colors print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
        </div>
    );
};

export default TemplateOverlayView;
