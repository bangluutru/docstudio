import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ClipboardPaste,
  PlusCircle,
  Printer,
  Languages,
  Edit3,
  Eye,
  AlertTriangle,
  Trash2,
  FileText,
  HardDrive,
  CheckCircle2,
  X,
  Plus,
  Layers,
  BookOpen,
} from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import UndoToast from './components/UndoToast';
import PageNavigator from './components/PageNavigator';

// --- UI Translations ---
const uiTranslations = {
  vn: {
    signer: "NGƯỜI LẬP BÁO CÁO",
    signDesc: "(Ký và ghi rõ họ tên)",
    appendix: "Phụ lục I - Nghị định 46/2026/NĐ-CP",
    page: "Trang",
    empty: "Vui lòng dán dữ liệu JSON vào cột trái để bắt đầu",
    formDefault: "Mẫu số: T-01/BCT",
    internalReport: "Báo cáo nội bộ",
    pasteLabel: "Nhập Dữ Liệu JSON",
    appendBtn: "Nối thêm trang",
    total: "Tổng cộng",
    totalUnit: "trang",
    clearBtn: "Xóa toàn bộ dữ liệu",
    confirmClear: "Bạn có chắc chắn muốn xóa toàn bộ dữ liệu hiện tại không?",
    printBtn: "Xuất PDF / In",
    editBtn: "Chỉnh sửa",
    previewBtn: "Xem thử",
    saving: "Đang lưu...",
    saved: "Đã lưu",
    errorPrefix: "Lỗi phân tích dữ liệu: ",
    errorNoArray: "Không tìm thấy cấu trúc mảng [ { ... } ] hợp lệ.",
    errorNotArray: "Dữ liệu phải là một mảng (Array).",
    placeholder: '[ { "title_vn": "...", "content_vn": ["..."] } ]',
    overflowWarning: "⚠️ Nội dung tràn trang — hãy bớt text hoặc tách thành 2 trang",
    deletedPage: "Đã xóa trang",
    coverLabel: "TRANG BÌA",
    appendixLabel: "PHỤ LỤC",
    certificateLabel: "PHIẾU KIỂM NGHIỆM",
    dateLabel: "Ngày:",
    addLine: "Thêm dòng",
    judgment: "ĐẠT CHUẨN",
    metaLabel: "Thông tin chung",
    testResults: "Kết quả kiểm nghiệm",
    addTableRow: "+ Thêm hàng",
  },
  en: {
    signer: "REPORT PREPARER",
    signDesc: "(Sign and write full name)",
    appendix: "Appendix I - Decree 46/2026/ND-CP",
    page: "Page",
    empty: "Please paste JSON data in the left column to start",
    formDefault: "Form: T-01/BCT",
    internalReport: "Internal Report",
    pasteLabel: "Input JSON Data",
    appendBtn: "Append Pages",
    total: "Total",
    totalUnit: "pages",
    clearBtn: "Clear all data",
    confirmClear: "Are you sure you want to clear all current data?",
    printBtn: "Export PDF / Print",
    editBtn: "Edit",
    previewBtn: "Preview",
    saving: "Saving...",
    saved: "Saved",
    errorPrefix: "Parse error: ",
    errorNoArray: "No valid array structure [ { ... } ] found.",
    errorNotArray: "Data must be an Array.",
    placeholder: '[ { "title_en": "...", "content_en": ["..."] } ]',
    overflowWarning: "⚠️ Content overflows page — reduce text or split into 2 pages",
    deletedPage: "Page deleted",
    coverLabel: "COVER PAGE",
    appendixLabel: "APPENDIX",
    certificateLabel: "TEST CERTIFICATE",
    dateLabel: "Date:",
    addLine: "Add line",
    judgment: "PASSED",
    metaLabel: "General Information",
    testResults: "Test Results",
    addTableRow: "+ Add row",
  },
  jp: {
    signer: "作成者",
    signDesc: "(署名・氏名を記入)",
    appendix: "付録 I - 政令 46/2026/NĐ-CP",
    page: "ページ",
    empty: "左の列にJSONデータを貼り付けてください",
    formDefault: "様式: T-01/BCT",
    internalReport: "内部報告書",
    pasteLabel: "JSONデータ入力",
    appendBtn: "ページを追加",
    total: "合計",
    totalUnit: "ページ",
    clearBtn: "全データを削除",
    confirmClear: "現在のデータをすべて削除しますか？",
    printBtn: "PDFに書き出す / 印刷",
    editBtn: "編集",
    previewBtn: "プレビュー",
    saving: "保存中...",
    saved: "保存済み",
    errorPrefix: "解析エラー: ",
    errorNoArray: "有効な配列構造 [ { ... } ] が見つかりません。",
    errorNotArray: "データは配列でなければなりません。",
    placeholder: '[ { "title_jp": "...", "content_jp": ["..."] } ]',
    overflowWarning: "⚠️ コンテンツがページを超えています — テキストを減らすか2ページに分割してください",
    deletedPage: "ページを削除しました",
    coverLabel: "表紙",
    appendixLabel: "付録",
    certificateLabel: "試験証明書",
    dateLabel: "日付:",
    addLine: "行を追加",
    judgment: "合格",
    metaLabel: "基本情報",
    testResults: "試験結果",
    addTableRow: "+ 行を追加",
  },
};

const STORAGE_KEY = 'docstudio_pages_v1';

// =====================================================================
// P0: Global Translation Helper (Single Source of Truth)
// =====================================================================
// Extracts a string/array from an object by checking:
// 1. obj[`${baseKey}_${lang}`]
// 2. obj[`${baseKey}_vn`] (fallback)
// 3. obj[baseKey] (no language suffix fallback)
// Returns empty string '' if none found, unless defaultVal is provided.
const getLangVal = (obj, baseKey, lang, defaultVal = '') => {
  if (!obj) return defaultVal;
  if (obj[`${baseKey}_${lang}`] !== undefined) return obj[`${baseKey}_${lang}`];
  if (obj[`${baseKey}_vn`] !== undefined) return obj[`${baseKey}_vn`];
  if (obj[baseKey] !== undefined) return obj[baseKey];
  return defaultVal;
};

// =====================================================================
// P0-A: Overflow detection hook — watches a DOM element for overflow
// =====================================================================
function useOverflowDetect(ref) {
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setIsOverflowing(el.scrollHeight > el.clientHeight + 2); // 2px tolerance
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    // Also re-check when content changes (MutationObserver)
    const mutObs = new MutationObserver(check);
    mutObs.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      mutObs.disconnect();
    };
  }, [ref]);

  return isOverflowing;
}

// =====================================================================
// PageCard — a single A4 page with all P0-P2 features baked in
// =====================================================================
const PageCard = ({
  page, index, totalPages, isEditing,
  displayLang, t,
  onEditChange, onDeletePage, onAddLine, onDeleteLine,
  pageRef,
}) => {
  const contentRef = useRef(null);
  const isOverflowing = useOverflowDetect(contentRef);

  const currentTitle = getLangVal(page, 'title', displayLang);
  const currentContent = getLangVal(page, 'content', displayLang, []);

  const isLastPage = index === totalPages - 1;
  const pageType = page.pageType || 'default'; // 'cover' | 'default' | 'appendix' | 'certificate'

  // ── P2-B: Cover page layout ──
  if (pageType === 'cover') {
    return (
      <div
        ref={pageRef}
        className="page-a4 page-font bg-white w-[210mm] h-[297mm] p-[25mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col items-center justify-center text-black border border-slate-100 rounded-sm"
      >
        {/* Delete button — no-print */}
        <button
          onClick={() => onDeletePage(index)}
          className="no-print absolute top-4 right-4 w-7 h-7 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
        >
          <X size={13} />
        </button>

        <div className="text-center space-y-6 w-full">
          {/* Cover badge */}
          <div className="flex items-center justify-center gap-2 text-indigo-400 mb-8">
            <Layers size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.coverLabel}</span>
          </div>

          {/* Organization */}
          {(page.organization_vn || page.organization || page[`organization_${displayLang}`]) && (
            <p className="text-[11pt] font-sans font-semibold text-slate-500 uppercase tracking-widest">
              {getLangVal(page, 'organization', displayLang)}
            </p>
          )}

          {/* Main Title */}
          <div className="py-8 border-y-2 border-slate-200 w-full">
            {isEditing ? (
              <textarea
                className="w-full text-center font-black text-3xl uppercase bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-3 text-indigo-900 resize-none rounded font-sans leading-snug"
                value={currentTitle}
                rows={3}
                onChange={(e) => onEditChange(index, `title_${displayLang}`, e.target.value)}
              />
            ) : (
              <h1 className="font-black text-3xl uppercase leading-tight tracking-wide font-sans text-slate-900">
                {currentTitle}
              </h1>
            )}
          </div>

          {/* Subtitle / first content line */}
          {currentContent[0] && (
            <p className="text-[13pt] text-slate-500 italic font-serif">{currentContent[0]}</p>
          )}

          {/* Date */}
          {page.date && (
            <p className="text-[11pt] font-sans text-slate-400 mt-8">
              {t.dateLabel} {page.date}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-[10mm] left-[25mm] right-[25mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2.5">
          <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
          <span className="text-[8pt] font-bold uppercase text-slate-400">{t.page} {index + 1} / {totalPages}</span>
        </div>
      </div>
    );
  }

  // ── P2-B: Appendix page layout ──
  if (pageType === 'appendix') {
    return (
      <div
        ref={pageRef}
        className="page-a4 page-font bg-white w-[210mm] h-[297mm] p-[25mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col text-black border border-slate-100 rounded-sm group"
      >
        <DeletePageBtn onDelete={() => onDeletePage(index)} />

        {/* Appendix Header */}
        <div className="font-sans mb-8 pb-4 border-b-2 border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <BookOpen size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.appendixLabel}</span>
          </div>
          <div className="flex justify-between items-start text-slate-400 text-[9px] uppercase tracking-widest">
            <span>{page.formNo || t.formDefault}</span>
            <span>{t.appendix}</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          {isEditing ? (
            <textarea
              className="w-full font-bold text-xl uppercase bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-2 text-indigo-900 resize-none rounded font-sans"
              value={currentTitle}
              rows={2}
              onChange={(e) => onEditChange(index, `title_${displayLang}`, e.target.value)}
            />
          ) : (
            <h1 className="font-bold text-xl uppercase font-sans text-slate-800 pl-4 border-l-4 border-amber-400">
              {currentTitle}
            </h1>
          )}
        </div>

        {/* Content */}
        <div ref={contentRef} className="text-[11pt] leading-[1.8] text-justify space-y-3 flex-grow overflow-hidden">
          <ContentLines
            lines={currentContent}
            isEditing={isEditing}
            pageIndex={index}
            displayLang={displayLang}
            onEditChange={onEditChange}
            onAddLine={onAddLine}
            onDeleteLine={onDeleteLine}
            t={t}
          />
        </div>

        {isOverflowing && !isEditing && <OverflowWarning message={t.overflowWarning} />}

        {/* Footer */}
        <div className="absolute bottom-[10mm] left-[25mm] right-[25mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2.5">
          <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
          <span className="text-[8pt] font-bold uppercase text-slate-400">{t.page} {index + 1} / {totalPages}</span>
        </div>
      </div>
    );
  }

  // ── P2-B: Certificate page layout (phiếu phân tích / kiểm nghiệm) ──
  if (pageType === 'certificate') {
    return (
      <CertificatePage
        page={page}
        index={index}
        totalPages={totalPages}
        isEditing={isEditing}
        displayLang={displayLang}
        t={t}
        onEditChange={onEditChange}
        onDeletePage={onDeletePage}
        pageRef={pageRef}
        isOverflowing={isOverflowing}
        contentRef={contentRef}
      />
    );
  }

  // ── Default page layout ──
  return (
    <div
      ref={pageRef}
      className="page-a4 page-font bg-white w-[210mm] h-[297mm] p-[25mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col text-black border border-slate-100 rounded-sm group"
    >
      {/* P1-A: Per-page Delete */}
      <DeletePageBtn onDelete={() => onDeletePage(index)} />

      {/* Header */}
      <div className="font-sans flex justify-between items-start mb-8 text-slate-500">
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[11px] uppercase tracking-tight opacity-80">
            {page.formNo || t.formDefault}
          </span>
          <span className="text-[9px] uppercase tracking-widest font-medium text-slate-400">
            {t.internalReport}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[9px] italic text-slate-400">{t.appendix}</span>
        </div>
      </div>

      {/* Main Title */}
      <div className="mb-10">
        {isEditing ? (
          <textarea
            className="w-full text-center font-bold text-2xl uppercase bg-amber-50 border-b-2 border-amber-300 focus:bg-amber-100 focus:outline-none p-3 text-indigo-900 resize-none rounded-t-lg font-sans leading-snug"
            value={currentTitle}
            rows={2}
            onChange={(e) => onEditChange(index, `title_${displayLang}`, e.target.value)}
          />
        ) : (
          <h1 className="text-center font-bold text-[22pt] uppercase leading-tight underline underline-offset-8 decoration-1 decoration-slate-300 font-sans">
            {currentTitle}
          </h1>
        )}
      </div>

      {/* Main Content — P0-A: ref for overflow detection */}
      <div ref={contentRef} className="text-[12pt] leading-[1.8] text-justify space-y-4 flex-grow overflow-hidden">
        <ContentLines
          lines={currentContent}
          isEditing={isEditing}
          pageIndex={index}
          displayLang={displayLang}
          onEditChange={onEditChange}
          onAddLine={onAddLine}
          onDeleteLine={onDeleteLine}
          t={t}
        />
      </div>

      {/* P0-A: Overflow Warning */}
      {isOverflowing && !isEditing && <OverflowWarning message={t.overflowWarning} />}

      {/* Signature — only on last page */}
      {isLastPage && (
        <div className="mt-10 grid grid-cols-2 text-center font-sans">
          <div />
          <div className="flex flex-col items-center">
            <span className="font-bold text-[11pt] uppercase tracking-wide">{t.signer}</span>
            <span className="italic text-[10pt] mt-1 text-slate-400">{t.signDesc}</span>
            <div className="h-20 w-full" />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-[10mm] left-[25mm] right-[25mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2.5">
        <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
        <span className="text-[8pt] font-bold uppercase tracking-widest text-slate-400">
          {t.page} {index + 1} / {totalPages}
        </span>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────

// P1-A: Delete button shown on hover
const DeletePageBtn = ({ onDelete }) => (
  <button
    onClick={onDelete}
    className="no-print absolute top-3 right-3 w-8 h-8 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 z-10"
    title="Xóa trang này"
  >
    <X size={14} />
  </button>
);

// P0-A: Overflow warning banner
const OverflowWarning = ({ message }) => (
  <div className="no-print absolute bottom-[20mm] left-[25mm] right-[25mm] flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-700 text-[9pt] font-sans font-semibold px-3 py-2 rounded-lg shadow-sm">
    <AlertTriangle size={13} className="shrink-0 text-amber-500" />
    {message}
  </div>
);

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
                  title="Xóa dòng"
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

// =====================================================================
// CertificatePage — renders pageType: "certificate"
// Schema: { meta[], table: {headers_*, rows[][]}, content_*, footer_*, judgment }
// =====================================================================
const CertificatePage = ({
  page, index, totalPages, isEditing,
  displayLang, t, onEditChange, onDeletePage,
  pageRef, isOverflowing, contentRef,
}) => {
  const lang = displayLang;
  const currentTitle = getLangVal(page, 'title', lang);
  const currentContent = getLangVal(page, 'content', lang, []);
  const currentFooter = getLangVal(page, 'footer', lang);
  const meta = page.meta || [];

  const tableHeaders = page.table ? getLangVal(page.table, 'headers', lang, []) : [];
  // CORE FIX: Use rows_en/jp/vn if available, fallback to rows, else []
  const tableRows = page.table ? getLangVal(page.table, 'rows', lang, []) : [];

  const handleMetaValueChange = (i, newVal) => {
    const newMeta = meta.map((m, mi) => {
      if (mi !== i) return m;
      // Prefer to update the lang-specific value if it exists, else 'value'
      const key = (`value_${lang}` in m) ? `value_${lang}` : 'value';
      return { ...m, [key]: newVal };
    });
    onEditChange(index, 'meta', newMeta);
  };

  const handleCellChange = (ri, ci, newVal) => {
    const newRows = tableRows.map((row, r) =>
      r === ri ? row.map((cell, c) => c === ci ? newVal : cell) : row
    );

    // Attempt to keep old 'rows' fallback synced if it existed, but prioritize language rows
    const updatedTable = { ...page.table };
    // Always store under the language key to enforce isolation and prevent overwriting
    updatedTable[`rows_${lang}`] = newRows;

    // Also update generic rows if we are on VN to smooth transition for older JSON
    if (lang === 'vn' && updatedTable.rows) {
      updatedTable.rows = newRows;
    }

    onEditChange(index, 'table', updatedTable);
  };

  const handleAddTableRow = () => {
    const emptyRow = tableHeaders.map(() => '');
    const newRows = [...tableRows, emptyRow];

    const updatedTable = { ...page.table };
    updatedTable[`rows_${lang}`] = newRows;
    if (lang === 'vn' && updatedTable.rows) updatedTable.rows = newRows;

    onEditChange(index, 'table', updatedTable);
  };

  const handleDeleteTableRow = (ri) => {
    const newRows = tableRows.filter((_, r) => r !== ri);

    const updatedTable = { ...page.table };
    updatedTable[`rows_${lang}`] = newRows;
    if (lang === 'vn' && updatedTable.rows) updatedTable.rows = newRows;

    onEditChange(index, 'table', updatedTable);
  };

  return (
    <div
      ref={pageRef}
      className="page-a4 page-font bg-white w-[210mm] h-[297mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col text-black border border-slate-100 rounded-sm group"
      style={{ fontFamily: "'Times New Roman', Times, serif", padding: '12mm 15mm 15mm 15mm' }}
    >
      <DeletePageBtn onDelete={() => onDeletePage(index)} />

      {/* Doc Header — date / recipient line above title (Japanese doc style) */}
      {page.doc_header && (
        <div className="font-sans flex justify-between items-start mb-3 text-[9pt] text-black">
          <div className="font-normal">{getLangVal(page.doc_header, 'recipient', lang)}</div>
          <div className="font-normal text-right">{getLangVal(page.doc_header, 'date', lang)}</div>
        </div>
      )}

      {/* Doc Header */}
      <div className="font-sans flex justify-between items-start mb-3 text-[8pt] text-slate-500">
        <div>
          <div className="font-bold tracking-widest">{getLangVal(page, 'formNo', lang)}</div>
          <div className="font-normal italic text-slate-400">{getLangVal(page, 'internalReport', lang)}</div>
        </div>
        <div className="text-right italic text-slate-400">
          {getLangVal(page, 'subtitle', lang)}
        </div>
      </div>

      {/* Certificate badge */}
      {page.showBadge !== false && (
        <div className="flex items-center justify-center gap-2 text-blue-500 mb-2 mt-4">
          <span className="text-[9px] font-sans font-bold uppercase tracking-widest border border-blue-200 px-3 py-0.5 rounded-full">
            {getLangVal(page, 'badge', lang, t.certificateLabel)}
          </span>
        </div>
      )}

      {/* Main Title */}
      <div className="mb-3 text-center relative z-10">
        {isEditing ? (
          <textarea
            className="w-full text-center font-bold text-[15pt] bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-1 resize-none rounded font-sans leading-snug"
            value={currentTitle}
            rows={2}
            onChange={(e) => onEditChange(index, `title_${lang}`, e.target.value)}
          />
        ) : (
          <h1 className="font-bold text-[15pt] leading-tight border-b-2 border-black inline-block pb-0.5 px-6">
            {currentTitle}
          </h1>
        )}
      </div>

      {/* Company Info under title (right aligned) */}
      {page.company_info && (
        <div className="text-right font-sans text-[10.5pt] font-bold mb-6 mr-4 leading-snug relative z-10">
          <div>{getLangVal(page.company_info, 'name', lang)}</div>
          <div className="mt-0.5">{getLangVal(page.company_info, 'department', lang)}</div>
        </div>
      )}

      {/* Intro content (optional) */}
      {currentContent.length > 0 && (
        <div className="mb-3 text-[9.5pt] leading-[1.5] italic text-slate-700">
          {currentContent.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}

      {/* Meta table — key/value info block */}
      {meta.length > 0 && (
        <table
          className={`mb-4 mt-2 border-collapse text-[9.5pt] ${page.meta_half_width ? 'w-[45%]' : 'w-full'}`}
          style={{ borderColor: '#000' }}
        >
          <tbody>
            {meta.map((m, i) => {
              const label = getLangVal(m, 'label', lang);
              const rawVal = getLangVal(m, 'value', lang);
              return (
                <tr key={i}>
                  <td
                    className="border border-black font-bold px-2 py-1 align-top"
                    style={{ width: '35%', background: '#f5f5f5', fontFamily: 'inherit' }}
                  >
                    {label}
                  </td>
                  <td
                    className="border border-black px-2 py-1 align-top"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {isEditing ? (
                      <input
                        className="w-full bg-amber-50 border-b border-amber-300 focus:outline-none focus:bg-amber-100 text-[10pt]"
                        style={{ fontFamily: 'inherit' }}
                        value={String(rawVal)}
                        onChange={(e) => handleMetaValueChange(i, e.target.value)}
                      />
                    ) : String(rawVal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Data table — test results */}
      {page.table && (
        <div ref={contentRef} className="flex-grow overflow-hidden">
          {(getLangVal(page, 'testResultsTitle', lang) || tableHeaders.length > 0) && (
            <p className="font-bold font-sans text-[10pt] uppercase tracking-wide mb-1.5 border-l-4 border-slate-700 pl-2">
              {getLangVal(page, 'testResultsTitle', lang, t.testResults)}
            </p>
          )}
          <table
            className="w-full border-collapse text-[10pt]"
            style={{ borderColor: '#000' }}
          >
            <thead>
              <tr>
                {isEditing && <th style={{ width: 24, border: '1px solid #000', background: '#e5e7eb', padding: '4px 6px' }} />}
                {tableHeaders.map((h, i) => (
                  <th
                    key={i}
                    style={{ border: '1px solid #000', background: '#f3f4f6', fontWeight: 700, padding: '6px 8px', textAlign: 'center', fontFamily: 'inherit' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri}>
                  {isEditing && (
                    <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', width: 24 }}>
                      <button
                        onClick={() => handleDeleteTableRow(ri)}
                        className="text-red-400 hover:text-red-600 text-[10px] font-bold leading-none"
                        title="Xóa hàng"
                      >×</button>
                    </td>
                  )}
                  {row.map((cell, ci) => {
                    // SVG cell: string containing <svg> OR object {svg, size_mm}
                    const isSvgObj = cell && typeof cell === 'object' && cell.svg;
                    const isSvgStr = typeof cell === 'string' && cell.trimStart().includes('<svg');
                    if (isSvgStr || isSvgObj) {
                      const raw = isSvgObj ? cell.svg : cell;
                      const defaultSizeMm = (isSvgObj ? cell.size_mm : null) || 13;
                      // Split multiple SVGs in one string (e.g. 3 stamps side-by-side)
                      const svgParts = raw.match(/<svg[\s\S]*?<\/svg>/gi) || [raw];
                      return (
                        <td
                          key={ci}
                          style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                          {svgParts.map((svgStr, si) => (
                            <div
                              key={si}
                              style={{
                                display: 'inline-block',
                                width: `${defaultSizeMm}mm`,
                                height: `${defaultSizeMm}mm`,
                                verticalAlign: 'middle',
                                margin: '0 1px',
                              }}
                              dangerouslySetInnerHTML={{ __html: svgStr }}
                            />
                          ))}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={ci}
                        style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontFamily: 'inherit', fontSize: '9pt' }}
                      >
                        {isEditing ? (
                          <input
                            className="w-full bg-amber-50 border-b border-amber-300 focus:outline-none text-center"
                            style={{ fontFamily: 'inherit', minWidth: 40, fontSize: '9pt' }}
                            value={cell}
                            onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                          />
                        ) : cell}
                      </td>
                    );
                  })}

                </tr>
              ))}
              {isEditing && (
                <tr>
                  <td colSpan={(tableHeaders.length || 1) + 1} style={{ border: '1px solid #000', padding: 0 }}>
                    <button
                      onClick={handleAddTableRow}
                      className="w-full py-1.5 text-blue-500 hover:bg-blue-50 font-sans font-bold text-[9pt] transition-colors"
                    >
                      {t.addTableRow}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {isOverflowing && !isEditing && <OverflowWarning message={t.overflowWarning} />}
        </div>
      )}

      {/* Footer note */}
      {currentFooter && (
        <div className="mt-4 pt-2 border-t border-slate-200 text-[9pt] italic text-slate-600">
          {currentFooter}
        </div>
      )}

      {/* Judgment stamp (CSS fallback — chỉ hiện khi không có stamps[] SVG) */}
      {page.judgment && (!page.stamps || page.stamps.length === 0) && (
        <div className="absolute bottom-[35mm] right-[18mm] rotate-[-10deg] border-4 border-red-600 text-red-600 font-black font-sans text-[13pt] px-3 py-1.5 rounded opacity-75 tracking-widest">
          {t.judgment}
        </div>
      )}

      {/* SVG Stamps — rendered from stamps[] array */}
      {/* Position: use position_x/position_y (0-100% from top-left of page)
          Fallback: keyword in 'position' field: top-left/top-right/bottom-left/bottom-right/center */}
      {page.stamps?.map((stamp, i) => {
        const sizeMm = stamp.size_mm || 35;
        const rotation = stamp.rotation ?? -12;
        const opacity = stamp.opacity ?? 0.80;

        // Priority 1: coordinate-based (position_x, position_y as 0-100%)
        let posStyle = {};
        if (stamp.position_x != null && stamp.position_y != null) {
          posStyle = {
            left: `${stamp.position_x}%`,
            top: `${stamp.position_y}%`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          };
        } else {
          // Priority 2: keyword fallback
          const kwMap = {
            'bottom-right': { bottom: '18mm', right: '12mm' },
            'bottom-left': { bottom: '18mm', left: '12mm' },
            'top-right': { top: '18mm', right: '12mm' },
            'top-left': { top: '18mm', left: '12mm' },
            'center': { top: '50%', left: '50%' },
          };
          posStyle = kwMap[stamp.position] || kwMap['bottom-right'];
          posStyle.transform = `${stamp.position === 'center' ? 'translate(-50%,-50%) ' : ''}rotate(${rotation}deg)`;
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...posStyle,
              width: `${sizeMm}mm`,
              height: `${sizeMm}mm`,
              opacity,
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: stamp.svg }}
          />
        );
      })}

      {/* Page footer */}
      <div className="absolute bottom-[6mm] left-[15mm] right-[15mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2">
        <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
        <span className="text-[8pt] font-bold uppercase text-slate-400">{t.page} {index + 1} / {totalPages}</span>
      </div>
    </div>
  );
};

// =====================================================================
// Main App
// =====================================================================
const UNDO_TIMEOUT_MS = 3000;

const App = () => {
  const [pages, setPages, clearPages] = useLocalStorage(STORAGE_KEY, []);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [displayLang, setDisplayLang] = useState('vn');
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // P1-A: Undo state
  const [deletedPage, setDeletedPage] = useState(null); // { page, index }
  const [toastVisible, setToastVisible] = useState(false);
  const undoTimerRef = useRef(null);

  // P1-B: Page refs for navigator scroll
  const pageRefs = useRef([]);

  // Sync pageRefs length
  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, pages.length);
  }, [pages.length]);

  const t = uiTranslations[displayLang] || uiTranslations.vn;

  // Save feedback
  const triggerSaveFeedback = useCallback(() => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    }, 300);
  }, []);

  const savePages = useCallback((newPages) => {
    setPages(newPages);
    triggerSaveFeedback();
  }, [setPages, triggerSaveFeedback]);

  // ── JSON Input ──
  const handleAppendData = () => {
    try {
      setError('');
      let cleaned = jsonInput
        .replace(/\[cite[\s\S]*?\]/gi, '')
        .replace(/\[source[\s\S]*?\]/gi, '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!match) throw new Error(t.errorNoArray);
      cleaned = match[0];

      const newData = JSON.parse(cleaned);
      if (!Array.isArray(newData)) throw new Error(t.errorNotArray);

      savePages([...pages, ...newData]);
      setJsonInput('');
    } catch (err) {
      setError(t.errorPrefix + err.message);
    }
  };

  // ── Edit changes ──
  const handleEditChange = useCallback((pageIndex, field, newValue, lineIndex = null) => {
    const newPages = [...pages];
    if (lineIndex !== null) {
      const newContent = [...newPages[pageIndex][field]];
      newContent[lineIndex] = newValue;
      newPages[pageIndex][field] = newContent;
    } else {
      newPages[pageIndex][field] = newValue;
    }
    savePages(newPages);
  }, [pages, savePages]);

  // P0-B: Add line
  const handleAddLine = useCallback((pageIndex, field, afterIndex) => {
    const newPages = [...pages];
    const content = [...(newPages[pageIndex][field] || [])];
    content.splice(afterIndex + 1, 0, '');
    newPages[pageIndex][field] = content;
    savePages(newPages);
  }, [pages, savePages]);

  // P0-B: Delete line
  const handleDeleteLine = useCallback((pageIndex, field, lineIndex) => {
    const newPages = [...pages];
    const content = [...(newPages[pageIndex][field] || [])];
    content.splice(lineIndex, 1);
    newPages[pageIndex][field] = content;
    savePages(newPages);
  }, [pages, savePages]);

  // P1-A: Delete page with undo
  const handleDeletePage = useCallback((index) => {
    // Clear any existing undo timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const pageToDelete = pages[index];
    const newPages = pages.filter((_, i) => i !== index);

    setPages(newPages);
    setDeletedPage({ page: pageToDelete, index });
    setToastVisible(true);
    triggerSaveFeedback();

    // Auto-dismiss after 3s
    undoTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setDeletedPage(null);
    }, UNDO_TIMEOUT_MS);
  }, [pages, setPages, triggerSaveFeedback]);

  // P1-A: Undo delete
  const handleUndoDelete = useCallback(() => {
    if (!deletedPage) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { page, index } = deletedPage;
    const restored = [...pages];
    restored.splice(index, 0, page);
    savePages(restored);
    setToastVisible(false);
    setDeletedPage(null);
  }, [deletedPage, pages, savePages]);

  // P2-A: Reorder via drag
  const handleReorder = useCallback((newPages) => {
    savePages(newPages);
  }, [savePages]);

  // Clear all
  const clearAllData = () => {
    if (window.confirm(t.confirmClear)) {
      clearPages();
      triggerSaveFeedback();
    }
  };

  // Print
  const handlePrint = () => {
    setIsEditing(false);
    setTimeout(() => {
      try { window.print(); } catch (e) { console.error('Print Error:', e); }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">

      {/* Print & Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Lora:ital,wght@0,400;0,600;0,700;1,400&display=swap');

        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #print-area {
            width: 210mm !important; margin: 0 !important;
            padding: 0 !important; display: block !important;
          }
          .page-a4 {
            width: 210mm !important; height: 297mm !important;
            margin: 0 !important; padding: 25mm !important;
            box-shadow: none !important; border: none !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            overflow: hidden;
            display: flex !important; flex-direction: column !important;
          }
        }
        .page-a4 { box-sizing: border-box; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .page-font { font-family: 'Lora', Georgia, serif; }

        /* Smooth group-hover for page delete button */
        .page-a4 .no-print.absolute { transition: opacity 0.15s; }
        .page-a4:hover .no-print.absolute { opacity: 1 !important; }
      `}</style>

      {/* ============================================================
          LEFT PANEL
      ============================================================ */}
      <aside className="no-print w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col shadow-sm z-[60]">

        {/* Brand */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-600 to-indigo-800 shrink-0">
          <div className="flex items-center gap-2.5 text-white mb-1">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
              <FileText size={18} strokeWidth={2.5} className="text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight uppercase italic">DocStudio</h1>
          </div>
          <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest mt-0.5">
            AI Document Manager
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
              className="w-full h-36 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs mb-2.5 outline-none transition-all resize-none shadow-inner text-slate-700"
            />

            <button
              onClick={handleAppendData}
              disabled={!jsonInput.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-sm"
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

          {/* Page count */}
          <section className="pt-3 border-t border-slate-100">
            <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-500">{t.total}:</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-2xl text-slate-800">{pages.length}</span>
                <span className="text-xs text-slate-400">{t.totalUnit}</span>
              </div>
            </div>
          </section>

          {/* P1-B + P2-A: Page Navigator (drag-to-reorder) */}
          {pages.length > 0 ? (
            <PageNavigator
              pages={pages}
              pageRefs={pageRefs}
              displayLang={displayLang}
              onReorder={handleReorder}
            />
          ) : (
            /* JSON example (only shown when no pages) */
            <section className="pt-1">
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1.5 select-none transition-colors">
                  <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                  Xem cấu trúc JSON mẫu
                </summary>
                <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed">
                  {`[
  {
    "pageType": "cover",
    "title_vn": "BÁO CÁO...",
    "date": "27/02/2026"
  },
  {
    "pageType": "default",
    "title_vn": "Tiêu đề",
    "content_vn": [
      "Đoạn văn.",
      "- Danh sách"
    ],
    "formNo": "Mẫu số: T-01/BCT"
  },
  {
    "pageType": "appendix",
    "title_vn": "Phụ lục A"
  }
]`}
                </pre>
              </details>
            </section>
          )}

          {/* Clear all */}
          {pages.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={clearAllData}
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
                onChange={(e) => setDisplayLang(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold outline-none text-slate-700 cursor-pointer"
              >
                <option value="vn">Tiếng Việt</option>
                <option value="en">English</option>
                <option value="jp">日本語</option>
              </select>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-xl transition-all text-sm shadow-sm ${isEditing
                ? 'bg-amber-500 text-white shadow-amber-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
              {isEditing ? <><Eye size={14} /> {t.previewBtn}</> : <><Edit3 size={14} /> {t.editBtn}</>}
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={pages.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Printer size={15} /> {t.printBtn}
          </button>
        </div>

        {/* Pages Canvas */}
        <div id="print-area" className="flex flex-col gap-10 pb-24 items-center w-full">
          {pages.length === 0 ? (
            <div className="w-[210mm] h-[297mm] bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-300 gap-5">
              <FileText size={72} strokeWidth={1} />
              <p className="text-lg font-medium italic text-center px-8">{t.empty}</p>
            </div>
          ) : (
            pages.map((page, index) => (
              <PageCard
                key={`page-${index}-${pages.length}`}
                page={page}
                index={index}
                totalPages={pages.length}
                isEditing={isEditing}
                displayLang={displayLang}
                t={t}
                onEditChange={handleEditChange}
                onDeletePage={handleDeletePage}
                onAddLine={handleAddLine}
                onDeleteLine={handleDeleteLine}
                pageRef={(el) => { pageRefs.current[index] = el; }}
              />
            ))
          )}
        </div>
      </main>

      {/* P1-A: Undo Toast */}
      <UndoToast
        visible={toastVisible}
        message={`${t.deletedPage}`}
        onUndo={handleUndoDelete}
        onDismiss={() => {
          setToastVisible(false);
          setDeletedPage(null);
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        }}
      />
    </div>
  );
};

export default App;
