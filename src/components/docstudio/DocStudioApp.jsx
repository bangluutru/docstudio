import { useState, useRef } from 'react';
import { LayoutTemplate, Layers, User, PlusCircle, Search, MoreVertical, FileText, Download, Printer, Upload, Sparkles, ArrowLeft, FileUp } from 'lucide-react';
import { getLangVal } from '../../utils/lang';
import { parseMarkdownToSchema, applyFormatSuggestions } from '../../lib/docstudio/parsers';
import { validateSchema } from '../../lib/docstudio/validationEngine';
import { exportDocx } from '../../lib/docstudio/export';
import { analyzeAndSuggest } from '../../lib/docstudio/formatSuggester';
import { importDocx } from '../../lib/docstudio/docxImporter';
import DocStudioPreview from './DocStudioPreview';
import FormatSuggestionPanel from './FormatSuggestionPanel';
import LayoutSettingsBar from './LayoutSettingsBar';

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
        rawInputLabel: 'NỘI DUNG THÔ',
        rawInputPlaceholder: '# Báo cáo kết quả...\n\nNhập nội dung vào đây hoặc tải file lên...',
        previewEmpty: 'Tải file lên hoặc nhập nội dung, sau đó bấm "Phân tích & Gợi ý" để định dạng tự động.',
        validationLabel: 'Vấn đề phát hiện',
        noteLabel: 'Lưu ý',
        uploadBtn: 'Tải file lên',
        uploadHint: 'Hỗ trợ .txt, .md, .doc, .docx',
        backToDash: 'Quay lại',
        uploadSuccess: 'Đã tải file thành công!',
        analyzeBtn: 'Phân tích & Gợi ý',
        analyzingMsg: 'Đang phân tích văn bản...',
        panelTitle: 'Gợi ý định dạng',
        acceptAll: 'Chấp nhận tất cả',
        hint: 'Đổi kiểu bằng dropdown, sau đó bấm "Chấp nhận tất cả".',
        high: 'Cao', medium: 'Trung bình', low: 'Thấp',
        formatApplied: 'Đã áp dụng định dạng! Xem bản xem trước bên phải.',
        importingDocx: 'Đang đọc file DOCX...',
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
        rawInputLabel: 'RAW INPUT',
        rawInputPlaceholder: '# Report Title...\n\nType content here or upload a file...',
        previewEmpty: 'Upload a file or type content, then click "Analyze & Suggest" for auto-formatting.',
        validationLabel: 'Validation Issues',
        noteLabel: 'Note',
        uploadBtn: 'Upload File',
        uploadHint: 'Supports .txt, .md, .doc, .docx',
        backToDash: 'Back',
        uploadSuccess: 'File uploaded successfully!',
        analyzeBtn: 'Analyze & Suggest',
        analyzingMsg: 'Analyzing text...',
        panelTitle: 'Format Suggestions',
        acceptAll: 'Accept All',
        hint: 'Change format type via dropdown, then click "Accept All".',
        high: 'High', medium: 'Medium', low: 'Low',
        formatApplied: 'Format applied! Check the preview on the right.',
        importingDocx: 'Reading DOCX file...',
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
        rawInputLabel: '元のテキスト',
        rawInputPlaceholder: '# レポートタイトル...\n\nここに内容を入力またはファイルをアップロード...',
        previewEmpty: 'ファイルをアップロードまたは入力後、「分析 & 提案」で自動フォーマット。',
        validationLabel: '検証結果',
        noteLabel: '注意',
        uploadBtn: 'ファイルアップロード',
        uploadHint: '.txt, .md, .doc, .docx 対応',
        backToDash: '戻る',
        uploadSuccess: 'ファイルがアップロードされました！',
        analyzeBtn: '分析 & 提案',
        analyzingMsg: 'テキストを分析中...',
        panelTitle: 'フォーマット提案',
        acceptAll: 'すべて適用',
        hint: 'ドロップダウンで種類を変更し、「すべて適用」をクリック。',
        high: '高', medium: '中', low: '低',
        formatApplied: 'フォーマット適用済み！右側のプレビューをご確認ください。',
        importingDocx: 'DOCXファイルを読み込み中...',
    },
};

const MOCK_DOCS = [
    { id: '1', title_vn: 'Quyết định bổ nhiệm NS', title_en: 'Appointment Decision', title_jp: '人事任命決定', type: 'Official Letter', status: 'DRAFT', updatedAt: '2026-03-10', content: `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nQUYẾT ĐỊNH BỔ NHIỆM\n\nSố: 01/2026/QĐ-BN\n\nKính gửi: Phòng Nhân sự, Ông/Bà Lê Trí Nam\n\nĐiều 1: Bổ nhiệm chức danh\nBổ nhiệm Ông Lê Trí Nam giữ chức vụ Trưởng phòng Công nghệ kể từ ngày 15/03/2026.\n\nĐiều 2: Mức lương và phụ cấp\nMức lương cơ bản và phụ cấp được hưởng theo quy định của công ty.` },
    { id: '2', title_vn: 'Biên bản nghiệm thu dự án', title_en: 'Project Acceptance Report', title_jp: 'プロジェクト検収議事録', type: 'Meeting Minutes', status: 'GENERATED', updatedAt: '2026-03-09', content: `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nBIÊN BẢN NGHIỆM THU DỰ ÁN\n\nHôm nay, ngày 09 tháng 03 năm 2026, tại văn phòng công ty.\n\nThành phần tham dự:\n1. Đại diện Bên A: Ông Trần Hải Bằng\n2. Đại diện Bên B: Ông Lê Trí Nam\n\nNội dung nghiệm thu:\n1. Phần mềm quản lý tài liệu DocStudio\n2. Module tích hợp AI Rewrite\n\nKết luận:\nHai bên đồng ý nghiệm thu và ghi nhận hệ thống hoạt động ổn định.` },
    { id: '3', title_vn: 'Hợp đồng nguyên tắc Hojokin', title_en: 'Hojokin Framework Contract', title_jp: 'Hojokin基本契約', type: 'Contract', status: 'VALIDATED', updatedAt: '2026-03-08', content: `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nHỢP ĐỒNG NGUYÊN TẮC\n\nSố: 05/2026/HĐNT-HOJOKIN\n\nBÊN A: Công ty Cổ phần Genki Fami Việt Nam\nĐại diện: Ông Trần Hải Bằng\n\nBÊN B: Đối tác Hojokin\n\nĐiều 1: Phạm vi hợp tác\nHai bên đồng ý hợp tác triển khai hệ thống phân tích trợ cấp Hojokin Navigator tại thị trường Nhật Bản.\n\nĐiều 2: Nghĩa vụ các bên\nBên A cung cấp tài nguyên máy chủ. Bên B cung cấp dữ liệu pháp lý.` },
];

const TEMPLATE_BOILERPLATES = {
    'Official Letter': `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------o0o--------\n\nTÊN CÔNG VĂN / TỜ TRÌNH\n\nSố: .../2026/CV\n\nKính gửi: [Tên cơ quan/cá nhân nhận]\n\nCăn cứ vào...\n\nĐiều 1: [Tiêu đề nội dung]\nNội dung chi tiết...\n\nĐiều 2: Trách nhiệm thi hành\n...`,
    'Meeting Minutes': `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------o0o--------\n\nBIÊN BẢN HỌP / NGHIỆM THU\n\nThời gian: ...\nĐịa điểm: ...\n\nThành phần tham dự:\n1. [Ông/Bà A]\n2. [Ông/Bà B]\n\nNội dung cuộc họp:\n1. Vấn đề 1: ...\n2. Vấn đề 2: ...\n\nKết luận:\n...`,
    'Contract': `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n--------o0o--------\n\nHỢP ĐỒNG KINH TẾ / LAO ĐỘNG\n\nSố: .../2026/HĐ\n\nHôm nay, ngày ... tháng ... năm ..., tại ...\nChúng tôi gồm:\n\nBÊN A: [Tên Công ty/Cá nhân]\nĐại diện: ...\n\nBÊN B: [Tên Công ty/Cá nhân]\nĐại diện: ...\n\nĐiều 1: Nội dung hợp đồng\n...`
};

export default function DocStudioApp({ displayLang }) {
    const [activeSubTab, setActiveSubTab] = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [rawInput, setRawInput] = useState('');
    const [generatedSchema, setGeneratedSchema] = useState(null);
    const [validationIssues, setValidationIssues] = useState([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState('success'); // success | info | error
    const [suggestions, setSuggestions] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectionRange, setSelectionRange] = useState(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    // Layout Engine configuration state
    const [layoutConfig, setLayoutConfig] = useState({
        fontFamily: 'font-sans',
        fontSize: 'text-sm',
        lineSpacing: 'leading-relaxed',
        margins: 'p-[2.5cm]',
        headerOptions: { enabled: false, text: '' },
        footerOptions: { enabled: false, pageNumbers: true }
    });

    const t = dsTranslations[displayLang] || dsTranslations.vn;

    const getDocTitle = (doc) => {
        const key = `title_${displayLang}`;
        return doc[key] || doc.title_vn || doc.title_en;
    };

    // Analyze text and generate suggestions
    const handleAnalyze = () => {
        if (!rawInput.trim()) return;
        setIsAnalyzing(true);
        setStatusMessage(t.analyzingMsg);
        setStatusType('info');

        // Small delay for UX feel
        setTimeout(() => {
            const results = analyzeAndSuggest(rawInput);
            setSuggestions(results);
            setIsAnalyzing(false);
            setStatusMessage('');
            // Clear previous schema so user knows they need to accept
            setGeneratedSchema(null);
            setValidationIssues([]);
        }, 400);
    };

    // Update a single suggestion's type
    const handleUpdateSuggestion = (id, newType) => {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, suggestedType: newType } : s));
    };

    // Accept all suggestions → generate schema
    const handleAcceptAll = () => {
        const schema = applyFormatSuggestions(suggestions);
        setGeneratedSchema(schema);
        const issues = validateSchema(schema, 'Official Letter');
        setValidationIssues(issues);
        setSuggestions([]); // Clear suggestions after accepting
        setStatusMessage(t.formatApplied);
        setStatusType('success');
    };

    // Direct preview from raw markdown (legacy flow)
    const handleGeneratePreview = () => {
        const schema = parseMarkdownToSchema(rawInput);
        setGeneratedSchema(schema);
        const issues = validateSchema(schema, 'Official Letter');
        setValidationIssues(issues);
        setStatusMessage('');
        setSuggestions([]);
    };

    // Handle Text Selection for Notion-like AI Toolbar
    const handleTextSelect = (e) => {
        const { selectionStart, selectionEnd, value } = e.target;
        if (selectionStart !== selectionEnd && selectionStart !== null) {
            setSelectionRange({
                start: selectionStart,
                end: selectionEnd,
                text: value.substring(selectionStart, selectionEnd)
            });
        } else {
            setSelectionRange(null);
        }
    };

    // Simulate Notion AI rewrite
    const applyAIRewrite = (type) => {
        if (!selectionRange) return;
        setStatusMessage('AI đang viết lại...');
        setStatusType('info');

        // Hide menu & capture current range
        const { start, end, text } = selectionRange;
        setSelectionRange(null);

        // Simulate network delay
        setTimeout(() => {
            let newText = text;
            if (type === 'longer') newText = text + '\\n\\n(✨ AI đã mở rộng nội dung chi tiết dựa trên ngữ cảnh...)';
            if (type === 'shorter') newText = '(✨ Bản tóm tắt AI) ' + text.substring(0, Math.floor(text.length / 2)) + '...';
            if (type === 'professional') newText = '(✨ Đã làm mềm giọng văn) ' + text.replace(/tôi/gi, 'chúng tôi').replace(/yêu cầu/gi, 'đề xuất');

            const newRawInput = rawInput.substring(0, start) + newText + rawInput.substring(end);
            setRawInput(newRawInput);
            setStatusMessage('✨ AI đã viết lại đoạn văn bản của bạn!');
            setStatusType('success');

            // Auto trigger analysis
            setTimeout(() => {
                const results = analyzeAndSuggest(newRawInput);
                setSuggestions(results);
            }, 500);
        }, 1200);
    };

    // File upload handler — supports .txt, .md, .doc, .docx
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'docx' || ext === 'doc') {
            // DOCX import via mammoth
            setStatusMessage(t.importingDocx);
            setStatusType('info');
            try {
                const text = await importDocx(file);
                setRawInput(text);
                setStatusMessage(t.uploadSuccess);
                setStatusType('success');
                // Auto-trigger analysis
                setTimeout(() => {
                    const results = analyzeAndSuggest(text);
                    setSuggestions(results);
                }, 300);
            } catch (err) {
                setStatusMessage(err.message || 'Import failed');
                setStatusType('error');
            }
        } else {
            // Plain text (.txt, .md)
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                setRawInput(content);
                setStatusMessage(t.uploadSuccess);
                setStatusType('success');
                // Auto-trigger analysis
                setTimeout(() => {
                    const results = analyzeAndSuggest(content);
                    setSuggestions(results);
                }, 300);
            };
            reader.readAsText(file);
        }

        e.target.value = '';
    };

    // Handle clicking a document in the dashboard
    const handleLoadDocument = (doc) => {
        setRawInput(doc.content || '');
        setGeneratedSchema(null);
        setValidationIssues([]);
        setSuggestions([]);
        setStatusMessage('Đã tải tài liệu từ Workspace.');
        setStatusType('success');
        setActiveSubTab('editor');
    };

    // Handle clicking a template
    const handleLoadTemplate = (templateName) => {
        setRawInput(TEMPLATE_BOILERPLATES[templateName] || '');
        setGeneratedSchema(null);
        setValidationIssues([]);
        setSuggestions([]);
        setStatusMessage(`Đã tải mẫu: ${templateName}`);
        setStatusType('success');
        setActiveSubTab('editor');
    };

    // Download template as text file
    const handleDownloadTemplate = (e, templateName) => {
        e.stopPropagation();
        const content = TEMPLATE_BOILERPLATES[templateName];
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${templateName}_Template.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 w-full text-slate-800 font-sans">
            {/* Sidebar */}
            <aside className="print:hidden w-full md:w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 sticky top-0 h-screen overflow-y-auto">
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
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${activeSubTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Layers size={16} /> {t.navDocs}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('templates')}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${activeSubTab === 'templates' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <LayoutTemplate size={16} /> {t.navTemplates}
                    </button>
                </nav>
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

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-slate-50 p-6 relative print:p-0 print:bg-white print:overflow-visible">
                <div className="max-w-5xl mx-auto">
                    {/* ── Dashboard ── */}
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
                                        <input type="text" placeholder={t.searchPlaceholder} value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {MOCK_DOCS.filter(d => getDocTitle(d).toLowerCase().includes(searchQuery.toLowerCase())).map(doc => (
                                        <div key={doc.id} onClick={() => handleLoadDocument(doc)} className="p-4 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-sm">{getDocTitle(doc)}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{doc.type}</span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                        <span className="text-xs text-slate-400">{t.updated} {doc.updatedAt}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${doc.status === 'DRAFT' ? 'bg-slate-100 text-slate-500' : doc.status === 'GENERATED' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'} `}>
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

                    {/* ── Templates ── */}
                    {activeSubTab === 'templates' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <header className="mb-8">
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.templateTitle}</h2>
                                <p className="text-slate-500 text-sm mt-1">{t.templateSubtitle}</p>
                            </header>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {['Official Letter', 'Meeting Minutes', 'Contract'].map((template) => (
                                    <div key={template} onClick={() => handleLoadTemplate(template)} className="bg-white border border-slate-200 p-5 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                <LayoutTemplate size={20} />
                                            </div>
                                            <button
                                                onClick={(e) => handleDownloadTemplate(e, template)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                title="Tải mẫu định dạng chuẩn (.txt)"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                        <h3 className="font-bold text-slate-800">{template}</h3>
                                        <p className="text-xs text-slate-500 mt-1">A4 | Mẫu tài liệu chuẩn</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Editor ── */}
                    {activeSubTab === 'editor' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-[calc(100vh-3rem)] print:h-auto print:block">
                            {/* Toolbar */}
                            <header className="mb-3 flex justify-between items-center shrink-0 print:hidden">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveSubTab('dashboard')}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title={t.backToDash}>
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight text-slate-900">{t.editorTitle}</h2>
                                        <p className="text-slate-500 text-xs mt-0.5">{t.editorSubtitle}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <input ref={fileInputRef} type="file" accept=".txt,.md,.text,.markdown,.doc,.docx"
                                        onChange={handleFileUpload} className="hidden" />
                                    <button onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                                        title={t.uploadHint}>
                                        <Upload size={14} /> {t.uploadBtn}
                                    </button>
                                    <button onClick={handleAnalyze} disabled={!rawInput.trim() || isAnalyzing}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                                        <Sparkles size={14} /> {t.analyzeBtn}
                                    </button>
                                    <button onClick={handleGeneratePreview} disabled={!rawInput.trim()}
                                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-xs font-bold rounded-lg transition-all">
                                        {t.generatePreview}
                                    </button>
                                    {generatedSchema && (
                                        <>
                                            <button onClick={() => window.print()}
                                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                                                <Printer size={14} /> PDF
                                            </button>
                                            <button onClick={() => exportDocx(generatedSchema, 'DocStudio_Export.docx', layoutConfig)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                                                <Download size={14} /> DOCX
                                            </button>
                                        </>
                                    )}
                                </div>
                            </header>

                            {/* Status message */}
                            {statusMessage && (
                                <div className={`print:hidden mb-3 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0 ${statusType === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : statusType === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                                    {statusType === 'info' ? <Sparkles size={14} className="animate-spin text-blue-500" /> : <Sparkles size={14} />}
                                    {statusMessage}
                                </div>
                            )}

                            {/* Main editor area */}
                            <div className="flex-1 flex gap-4 min-h-0 print:block print:overflow-visible">
                                {/* Left: Editor + Suggestions + Validation */}
                                <div className="w-1/2 flex flex-col gap-3 min-h-0 print:hidden">
                                    {/* Textarea */}
                                    <div className={`relative flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${suggestions.length > 0 ? 'h-1/3' : 'flex-1'}`}>
                                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.rawInputLabel}</span>
                                            <span className="text-[10px] text-slate-400">{t.uploadHint}</span>
                                        </div>
                                        <textarea
                                            ref={textareaRef}
                                            value={rawInput}
                                            onChange={(e) => setRawInput(e.target.value)}
                                            onSelect={handleTextSelect}
                                            onBlur={() => setTimeout(() => setSelectionRange(null), 200)}
                                            className="flex-1 p-4 resize-none outline-none font-mono text-sm text-slate-700 custom-scrollbar"
                                            placeholder={t.rawInputPlaceholder}
                                        />

                                        {/* Notion-style AI Floating Toolbar */}
                                        {selectionRange && (
                                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white rounded-lg shadow-2xl p-1.5 flex items-center gap-1 z-50 animate-in slide-in-from-bottom-3 fade-in duration-200">
                                                <span className="text-xs font-bold text-slate-300 px-2 flex-1 whitespace-nowrap">
                                                    <Sparkles size={12} className="inline mr-1 text-indigo-400" /> AI Rewrite
                                                </span>
                                                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                                                <button onClick={() => applyAIRewrite('longer')} className="px-2.5 py-1.5 hover:bg-slate-800 rounded-md text-xs font-semibold text-slate-200 transition-colors">Dài hơn</button>
                                                <button onClick={() => applyAIRewrite('shorter')} className="px-2.5 py-1.5 hover:bg-slate-800 rounded-md text-xs font-semibold text-slate-200 transition-colors">Ngắn gọn</button>
                                                <button onClick={() => applyAIRewrite('professional')} className="px-2.5 py-1.5 hover:bg-slate-800 rounded-md text-xs font-semibold text-slate-200 transition-colors">Văn phong Pro</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Format Suggestion Panel */}
                                    {suggestions.length > 0 && (
                                        <div className="flex-1 min-h-0">
                                            <FormatSuggestionPanel
                                                suggestions={suggestions}
                                                onUpdateSuggestion={handleUpdateSuggestion}
                                                onAcceptAll={handleAcceptAll}
                                                displayLang={displayLang}
                                                i18n={{
                                                    panelTitle: t.panelTitle,
                                                    acceptAll: t.acceptAll,
                                                    hint: t.hint,
                                                    high: t.high,
                                                    medium: t.medium,
                                                    low: t.low,
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Validation Panel */}
                                    {validationIssues.length > 0 && (
                                        <div className="h-40 bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
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
                                <div className="w-1/2 flex flex-col min-h-0 bg-slate-200 border border-slate-300 rounded-xl overflow-hidden print:w-full print:border-none print:shadow-none print:bg-transparent print:block print:overflow-visible">
                                    <div className="p-2 border-b border-slate-300 bg-white/50 backdrop-blur-sm z-10 shrink-0 print:hidden">
                                        <LayoutSettingsBar config={layoutConfig} onChange={setLayoutConfig} />
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 flex justify-center custom-scrollbar print:p-0 print:m-0 print:overflow-visible print:block">
                                        {generatedSchema ? (
                                            <DocStudioPreview schema={generatedSchema} layoutConfig={layoutConfig} />
                                        ) : (
                                            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg p-10 flex flex-col items-center justify-center">
                                                <FileUp size={48} className="text-slate-200 mb-4" />
                                                <p className="text-slate-400 text-center italic text-sm max-w-xs">{t.previewEmpty}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
