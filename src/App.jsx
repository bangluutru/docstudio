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
  Scale,
  Combine,
  Scissors,
  FileSpreadsheet,
} from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import UndoToast from './components/UndoToast';
import PageNavigator from './components/PageNavigator';
import LegalDocumentView from './components/LegalDocumentView';
import PdfSplitterView from './components/PdfSplitterView';
import PdfMergerView from './components/PdfMergerView';
import TemplateOverlayView from './components/TemplateOverlayView';
import ExcelMappingView from './components/ExcelMappingView';
import PageCard from './components/PageCard';
import { getLangVal } from './utils/lang';
import { uiTranslations } from './utils/translations';
import './print.css';


const STORAGE_KEY = 'docstudio_pages_v1';







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
  const [activeTab, setActiveTab] = useState('certificate'); // 'certificate' | 'legal'

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
    <>
      {/* ============================================================
          GLOBAL TAB BAR
      ============================================================ */}
      <div className="no-print w-full bg-white border-b border-slate-200 flex items-center px-4 py-0 sticky top-0 z-[70] shadow-sm">
        <button
          onClick={() => setActiveTab('certificate')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-3 transition-all ${activeTab === 'certificate'
            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
          <FileText size={15} /> {activeTab === 'certificate' ? t.tabCertificate : '📝'}
        </button>
        <button
          onClick={() => setActiveTab('legal')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-3 transition-all ${activeTab === 'legal'
            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Scale size={15} /> {activeTab === 'legal' ? t.tabLegal : '⚖️'}
        </button>
        <button
          onClick={() => setActiveTab('pdf-split')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-3 transition-all ${activeTab === 'pdf-split'
            ? 'border-rose-600 text-rose-700 bg-rose-50/50'
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Scissors size={15} /> {activeTab === 'pdf-split' ? t.tabPdfSplit : '✂️'}
        </button>
        <button
          onClick={() => setActiveTab('pdf-merge')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-3 transition-all ${activeTab === 'pdf-merge'
            ? 'border-violet-600 text-violet-700 bg-violet-50/50'
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Combine size={15} /> {activeTab === 'pdf-merge' ? t.tabPdfMerge : '📂'}
        </button>
        <button
          onClick={() => setActiveTab('pdf-overlay')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-3 transition-all ${activeTab === 'pdf-overlay'
            ? 'border-fuchsia-600 text-fuchsia-700 bg-fuchsia-50/50'
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Printer size={15} /> {activeTab === 'pdf-overlay' ? t.tabOverlay : '🖨️'}
        </button>
        <button
          onClick={() => setActiveTab('excelMapping')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-3 transition-all ${activeTab === 'excelMapping'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50'
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
          <FileSpreadsheet size={15} /> {activeTab === 'excelMapping' ? t.tabExcelMapping : '📊'}
        </button>
      </div>

      {/* ============================================================
          TAB CONTENT
      ============================================================ */}
      {activeTab === 'legal' ? (
        <LegalDocumentView displayLang={displayLang} onLangChange={setDisplayLang} />
      ) : activeTab === 'pdf-split' ? (
        <PdfSplitterView displayLang={displayLang} />
      ) : activeTab === 'pdf-merge' ? (
        <PdfMergerView displayLang={displayLang} />
      ) : activeTab === 'pdf-overlay' ? (
        <TemplateOverlayView displayLang={displayLang} />
      ) : activeTab === 'excelMapping' ? (
        <ExcelMappingView t={t} displayLang={displayLang} />
      ) : (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">


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
                  pageListTitle={t.pageListTitle}
                />
              ) : (
                /* JSON example (only shown when no pages) */
                <section className="pt-1">
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1.5 select-none transition-colors">
                      <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                      {t.viewJsonSample}
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

          <UndoToast
            visible={toastVisible}
            message={`${t.deletedPage}`}
            undoLabel={t.undoLabel}
            onUndo={handleUndoDelete}
            onDismiss={() => {
              setToastVisible(false);
              setDeletedPage(null);
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            }}
          />
        </div>
      )}
    </>
  );
};

export default App;
