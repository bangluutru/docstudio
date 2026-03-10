import { useState, useRef } from 'react';
import { LayoutTemplate, Layers, User, PlusCircle, Search, MoreVertical, FileText, Download, Printer, Upload, Sparkles, ArrowLeft } from 'lucide-react';
import { getLangVal } from '../../utils/lang';
import { parseMarkdownToSchema } from '../../lib/docstudio/parsers';
import { validateSchema } from '../../lib/docstudio/validationEngine';
import { exportDocx } from '../../lib/docstudio/export';
import DocStudioPreview from './DocStudioPreview';

// =====================================================================
// i18n translations for DocStudio Tab 9
// =====================================================================
const dsTranslations = {
    vn: {
        sidebarTitle: 'DocStudio',
        sidebarSubtitle: 'Quản lý & Xuất tài liệu',
        navDocs: 'Tài liệu',
        navTemplates: 'Mẫu tài liệu',
        guestUser: 'Khách',
        openAccess: 'TRUY CẬP MỞ',
        dashTitle: 'Tài liệu Workspace',
        dashSubtitle: 'Quản lý và chỉnh sửa tài liệu nội bộ.',
        createDoc: 'Tạo tài liệu',
        searchPlaceholder: 'Tìm kiếm tài liệu...',
        updated: 'Cập nhật',
        templateTitle: 'Thư viện Mẫu',
        templateSubtitle: 'Chọn mẫu để tạo tài liệu mới.',
        editorTitle: 'Tài liệu mới',
        editorSubtitle: 'Đang soạn: Công văn (Bản nháp)',
        generatePreview: 'Tạo bản xem trước',
        rawInputLabel: 'NỘI DUNG THÔ (MARKDOWN)',
        rawInputPlaceholder: '# Báo cáo kết quả...\n\nNhập nội dung vào đây...',
        previewEmpty: 'Bấm "Tạo bản xem trước" để xem kết quả định dạng tại đây.',
        validationLabel: 'Vấn đề phát hiện',
        noteLabel: 'Lưu ý',
        uploadBtn: 'Tải file lên',
        uploadHint: 'Hỗ trợ .txt, .md — Ứng dụng sẽ tự định dạng lại',
        backToDash: 'Quay lại',
        uploadSuccess: 'Đã tải file thành công! Bấm "Tạo bản xem trước" để định dạng.',
    },
    en: {
        sidebarTitle: 'DocStudio',
        sidebarSubtitle: 'Manage & Export',
        navDocs: 'Documents',
        navTemplates: 'Templates',
        guestUser: 'Guest User',
        openAccess: 'OPEN ACCESS',
        dashTitle: 'Workspace Documents',
        dashSubtitle: 'Manage and edit your internal structured documents.',
        createDoc: 'Create Document',
        searchPlaceholder: 'Search documents...',
        updated: 'Updated',
        templateTitle: 'Template Library',
        templateSubtitle: 'Select a template to create a new document.',
        editorTitle: 'New Document',
        editorSubtitle: 'Editing: Official Letter (Draft)',
        generatePreview: 'Generate Preview',
        rawInputLabel: 'RAW INPUT (MARKDOWN)',
        rawInputPlaceholder: '# Report Title...\n\nType content here...',
        previewEmpty: 'Click "Generate Preview" to view the document rendering here.',
        validationLabel: 'Validation Issues',
        noteLabel: 'Note',
        uploadBtn: 'Upload File',
        uploadHint: 'Supports .txt, .md — App will auto-format',
        backToDash: 'Back',
        uploadSuccess: 'File uploaded! Click "Generate Preview" to format.',
    },
    jp: {
        sidebarTitle: 'DocStudio',
        sidebarSubtitle: '管理 & エクスポート',
        navDocs: 'ドキュメント',
        navTemplates: 'テンプレート',
        guestUser: 'ゲスト',
        openAccess: 'オープンアクセス',
        dashTitle: 'ワークスペースドキュメント',
        dashSubtitle: '社内の構造化ドキュメントを管理・編集。',
        createDoc: 'ドキュメント作成',
        searchPlaceholder: 'ドキュメントを検索...',
        updated: '更新',
        templateTitle: 'テンプレートライブラリ',
        templateSubtitle: 'テンプレートを選択して新しいドキュメントを作成。',
        editorTitle: '新しいドキュメント',
        editorSubtitle: '編集中: 公式書簡（下書き）',
        generatePreview: 'プレビュー生成',
        rawInputLabel: '元のテキスト (MARKDOWN)',
        rawInputPlaceholder: '# レポートタイトル...\n\nここに内容を入力...',
        previewEmpty: '「プレビュー生成」をクリックしてドキュメントプレビューを表示。',
        validationLabel: '検証結果',
        noteLabel: '注意',
        uploadBtn: 'ファイルをアップロード',
        uploadHint: '.txt, .md 対応 — 自動整形します',
        backToDash: '戻る',
        uploadSuccess: 'ファイルがアップロードされました！「プレビュー生成」をクリックして整形。',
    },
};

const MOCK_DOCS = [
    { id: '1', title_vn: 'Quyết định bổ nhiệm NS', title_en: 'Appointment Decision', title_jp: '人事任命決定', type: 'Official Letter', status: 'DRAFT', updatedAt: '2026-03-10' },
    { id: '2', title_vn: 'Biên bản nghiệm thu dự án', title_en: 'Project Acceptance Report', title_jp: 'プロジェクト検収議事録', type: 'Meeting Minutes', status: 'GENERATED', updatedAt: '2026-03-09' },
    { id: '3', title_vn: 'Hợp đồng nguyên tắc Hojokin', title_en: 'Hojokin Framework Contract', title_jp: 'Hojokin基本契約', type: 'Contract', status: 'VALIDATED', updatedAt: '2026-03-08' },
];

export default function DocStudioApp({ displayLang }) {
    const [activeSubTab, setActiveSubTab] = useState('dashboard'); // dashboard | templates | editor
    const [searchQuery, setSearchQuery] = useState('');
    const [rawInput, setRawInput] = useState('');
    const [generatedSchema, setGeneratedSchema] = useState(null);
    const [validationIssues, setValidationIssues] = useState([]);
    const [uploadMessage, setUploadMessage] = useState('');
    const fileInputRef = useRef(null);

    const t = dsTranslations[displayLang] || dsTranslations.vn;

    const getDocTitle = (doc) => {
        const key = `title_${displayLang}`;
        return doc[key] || doc.title_vn || doc.title_en;
    };

    const handleGeneratePreview = () => {
        const schema = parseMarkdownToSchema(rawInput);
        setGeneratedSchema(schema);
        const issues = validateSchema(schema, 'Official Letter');
        setValidationIssues(issues);
        setUploadMessage('');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            setRawInput(content);
            setUploadMessage(t.uploadSuccess);
            // Auto-generate preview after upload
            setTimeout(() => {
                const schema = parseMarkdownToSchema(content);
                setGeneratedSchema(schema);
                const issues = validateSchema(schema, 'Official Letter');
                setValidationIssues(issues);
            }, 300);
        };
        reader.readAsText(file);
        // Reset file input so the same file can be re-uploaded
        e.target.value = '';
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 w-full text-slate-800 font-sans">
            {/* Sidebar for DocStudio Module */}
            <aside className="no-print w-full md:w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 sticky top-0 h-screen overflow-y-auto">
                <div className="p-5 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-inner">
                            <LayoutTemplate size={18} strokeWidth={2.5} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-white m-0 leading-tight">{t.sidebarTitle}</h1>
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest block">
                                {t.sidebarSubtitle}
                            </p>
                        </div>
                    </div>
                </div>
                <nav className="p-3 space-y-1">
                    <button
                        onClick={() => setActiveSubTab('dashboard')}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${activeSubTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Layers size={16} /> {t.navDocs}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('templates')}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${activeSubTab === 'templates' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <LayoutTemplate size={16} /> {t.navTemplates}
                    </button>
                </nav>

                {/* User Info (Bottom of sidebar) */}
                <div className="absolute flex-col flex bottom-0 w-full p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                            <User size={14} className="text-slate-400" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-white truncate">{t.guestUser}</p>
                            <p className="text-[10px] text-emerald-400 font-mono tracking-wider">{t.openAccess}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-50 p-6 relative">
                <div className="max-w-5xl mx-auto">
                    {activeSubTab === 'dashboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <header className="mb-8 flex justify-between items-end">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.dashTitle}</h2>
                                    <p className="text-slate-500 text-sm mt-1">{t.dashSubtitle}</p>
                                </div>
                                <button
                                    onClick={() => setActiveSubTab('editor')}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm"
                                >
                                    <PlusCircle size={16} /> {t.createDoc}
                                </button>
                            </header>

                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex gap-4">
                                    <div className="relative flex-1">
                                        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder={t.searchPlaceholder}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {MOCK_DOCS.filter(d => getDocTitle(d).toLowerCase().includes(searchQuery.toLowerCase())).map(doc => (
                                        <div key={doc.id} className="p-4 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-sm">{getDocTitle(doc)}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                            {doc.type}
                                                        </span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                        <span className="text-xs text-slate-400">{t.updated} {doc.updatedAt}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide
                                                    ${doc.status === 'DRAFT' ? 'bg-slate-100 text-slate-500' :
                                                        doc.status === 'GENERATED' ? 'bg-blue-50 text-blue-600' :
                                                            'bg-emerald-50 text-emerald-600'}`}>
                                                    {doc.status}
                                                </span>
                                                <button className="text-slate-400 hover:text-slate-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSubTab === 'templates' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <header className="mb-8">
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.templateTitle}</h2>
                                <p className="text-slate-500 text-sm mt-1">{t.templateSubtitle}</p>
                            </header>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Dummy Templates */}
                                {['Official Letter', 'Meeting Minutes', 'Contract'].map((template) => (
                                    <div key={template} className="bg-white border border-slate-200 p-5 rounded-xl hover:shadow-md transition-shadow cursor-pointer group">
                                        <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            <LayoutTemplate size={20} />
                                        </div>
                                        <h3 className="font-bold text-slate-800">{template}</h3>
                                        <p className="text-xs text-slate-500 mt-1">A4 | 2.5cm Margins</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeSubTab === 'editor' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[calc(100vh-3rem)]">
                            <header className="mb-4 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setActiveSubTab('dashboard')}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                        title={t.backToDash}
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight text-slate-900">{t.editorTitle}</h2>
                                        <p className="text-slate-500 text-xs mt-0.5">{t.editorSubtitle}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".txt,.md,.text,.markdown"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                                        title={t.uploadHint}
                                    >
                                        <Upload size={14} /> {t.uploadBtn}
                                    </button>
                                    <button
                                        onClick={handleGeneratePreview}
                                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-all"
                                    >
                                        <span className="flex items-center gap-1.5"><Sparkles size={14} /> {t.generatePreview}</span>
                                    </button>

                                    {generatedSchema && (
                                        <>
                                            <button
                                                onClick={() => window.print()}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                                            >
                                                <Printer size={14} /> PDF
                                            </button>
                                            <button
                                                onClick={() => exportDocx(generatedSchema, 'DocStudio_Export.docx')}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                                            >
                                                <Download size={14} /> DOCX
                                            </button>
                                        </>
                                    )}
                                </div>
                            </header>

                            {/* Upload success message */}
                            {uploadMessage && (
                                <div className="mb-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium flex items-center gap-2 shrink-0">
                                    <Sparkles size={14} className="text-emerald-500" />
                                    {uploadMessage}
                                </div>
                            )}

                            <div className="flex-1 flex gap-4 min-h-0">
                                {/* Left: Editor + Issues */}
                                <div className="w-1/2 flex flex-col gap-4 min-h-0">
                                    <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.rawInputLabel}</span>
                                            <span className="text-[10px] text-slate-400">{t.uploadHint}</span>
                                        </div>
                                        <textarea
                                            value={rawInput}
                                            onChange={(e) => setRawInput(e.target.value)}
                                            className="flex-1 p-4 resize-none outline-none font-mono text-sm text-slate-700 custom-scrollbar"
                                            placeholder={t.rawInputPlaceholder}
                                        />
                                    </div>

                                    {/* Validation Panel */}
                                    {validationIssues.length > 0 && (
                                        <div className="h-48 bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
                                            <div className="p-2.5 bg-rose-50 border-b border-rose-100 flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                                                <Layers size={14} /> {t.validationLabel} ({validationIssues.length})
                                            </div>
                                            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2">
                                                {validationIssues.map(issue => (
                                                    <div key={issue.id} className="p-2 border border-slate-100 rounded bg-slate-50">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${issue.severity === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                {issue.severity}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-700">{issue.message}</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 ml-1">{t.noteLabel}: {issue.suggestion}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Right: Preview */}
                                <div className="w-1/2 bg-slate-200 border border-slate-300 rounded-xl overflow-y-auto p-4 flex justify-center custom-scrollbar">
                                    {generatedSchema ? (
                                        <DocStudioPreview schema={generatedSchema} />
                                    ) : (
                                        <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg p-10 flex flex-col items-center justify-center">
                                            <Layers size={48} className="text-slate-200 mb-4" />
                                            <p className="text-slate-400 text-center italic">{t.previewEmpty}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
