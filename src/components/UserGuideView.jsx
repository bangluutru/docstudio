import { useState } from 'react';
import {
    Award,
    Scale,
    Scissors,
    Combine,
    Printer,
    FileSpreadsheet,
    ChevronDown,
    ChevronRight,
    Sparkles,
    Languages,
} from 'lucide-react';

// =====================================================================
// UI Translations
// =====================================================================
const guideText = {
    vn: {
        title: 'Hướng dẫn sử dụng DocStudio',
        subtitle: 'Tìm hiểu cách sử dụng từng tính năng',
        intro: 'DocStudio là bộ công cụ xử lý tài liệu đa ngôn ngữ (Việt - Anh - Nhật). Dưới đây là hướng dẫn chi tiết cho từng tab:',
        tabs: [
            {
                icon: '🏅',
                name: 'Phiếu phân tích',
                color: 'indigo',
                what: 'Tạo phiếu kiểm nghiệm, chứng chỉ phân tích, báo cáo QC/QA từ dữ liệu JSON.',
                steps: [
                    '1. Bấm vào 「System Prompt cho Gemini」ở thanh bên trái để copy prompt',
                    '2. Mở Gemini → dán prompt → đính kèm hình ảnh tài liệu gốc',
                    '3. Gemini trả về JSON → copy toàn bộ',
                    '4. Dán JSON vào ô nhập liệu → bấm 「Tải trang」',
                    '5. Chuyển ngôn ngữ (VN/EN/JP) bằng nút ngôn ngữ bên phải',
                    '6. Bấm 「Chỉnh sửa」 để sửa trực tiếp trên preview',
                    '7. Bấm 「Xuất PDF / In」 để lưu file',
                ],
                tips: [
                    'Con dấu SVG được đặt tự động theo tọa độ trong JSON',
                    'Nếu nội dung tràn trang, hệ thống sẽ cảnh báo',
                    'Xóa trang → có 3 giây để Hoàn tác (Undo)',
                    'Dữ liệu tự động lưu vào bộ nhớ trình duyệt',
                ],
            },
            {
                icon: '⚖️',
                name: 'Văn bản pháp lý',
                color: 'emerald',
                what: 'Dịch thuật và hiển thị văn bản pháp luật (nghị định, thông tư, quyết định...) với định dạng Markdown chuyên nghiệp.',
                steps: [
                    '1. Bấm vào 「System Prompt cho Gemini」để copy prompt',
                    '2. Mở Gemini → dán prompt → đính kèm văn bản pháp lý cần dịch',
                    '3. Gemini trả về JSON → copy toàn bộ',
                    '4. Dán JSON vào ô nhập liệu → bấm 「Tải văn bản」',
                    '5. Chuyển ngôn ngữ để xem bản dịch VN/EN/JP',
                    '6. Bấm 「Chỉnh sửa」 để sửa nội dung (hỗ trợ Markdown)',
                    '7. Bấm 「Xuất PDF / In」 để lưu',
                ],
                tips: [
                    'Hỗ trợ Markdown: tiêu đề ##, **in đậm**, danh sách, bảng',
                    'Văn bản dài (>3000 từ): Gemini sẽ chia thành nhiều batch',
                    'Tự động xóa citation markers [cite:...] từ Gemini',
                    'Dữ liệu tự động lưu vào bộ nhớ trình duyệt',
                ],
            },
            {
                icon: '✂️',
                name: 'Tách PDF',
                color: 'rose',
                what: 'Upload 1 file PDF, xem preview từng trang, chọn trang cần giữ, tải riêng lẻ hoặc ghép lại.',
                steps: [
                    '1. Kéo thả file PDF vào vùng upload (hoặc click để chọn file)',
                    '2. Xem preview thumbnail từng trang',
                    '3. Bấm vào trang để chọn/bỏ chọn (hoặc dùng Chọn tất cả / Bỏ chọn)',
                    '4. Bấm 「Tải riêng lẻ」 để tải từng trang riêng',
                    '5. Hoặc bấm 「Ghép thành 1 file」 để ghép các trang đã chọn',
                ],
                tips: [
                    'Hỗ trợ kéo thả (Drag & Drop)',
                    'Mỗi trang hiện số trang và có nút tải riêng',
                    'Không cần đăng nhập, xử lý hoàn toàn offline',
                ],
            },
            {
                icon: '📂',
                name: 'Ghép PDF',
                color: 'violet',
                what: 'Upload nhiều file PDF, sắp xếp thứ tự bằng kéo thả, ghép thành 1 file duy nhất.',
                steps: [
                    '1. Kéo thả nhiều file PDF vào vùng upload',
                    '2. Sắp xếp thứ tự bằng cách kéo thả các file',
                    '3. Xem số trang của mỗi file',
                    '4. Xóa file không cần bằng nút ✕',
                    '5. Bấm 「Ghép file」 để tạo 1 file PDF duy nhất',
                ],
                tips: [
                    'Kéo thả để sắp xếp thứ tự file trước khi ghép',
                    'Hiện tổng số trang sau khi ghép',
                    'Xử lý hoàn toàn trên trình duyệt, không upload lên server',
                ],
            },
            {
                icon: '🖨️',
                name: 'In Biểu Mẫu',
                color: 'fuchsia',
                what: 'Nhập HTML template + dữ liệu JSON → render preview động → in/xuất PDF. Dùng cho phiếu kết quả, biểu mẫu tùy chỉnh.',
                steps: [
                    '1. Bấm vào 「System Prompt cho Gemini」để copy prompt tái tạo HTML',
                    '2. Gửi prompt + hình ảnh biểu mẫu cho Gemini',
                    '3. Copy phần HTML → dán vào ô 「HTML Template」',
                    '4. Copy phần JSON data → dán vào ô 「JSON Data」',
                    '5. Xem preview → điều chỉnh font size, spacing nếu cần',
                    '6. Click trực tiếp lên preview để sửa nội dung',
                    '7. Bấm 「In Preview」 để xuất PDF',
                ],
                tips: [
                    'Dùng {{key}} trong HTML để chèn dữ liệu động',
                    'Dữ liệu đa ngôn ngữ: {"key": {"vn": "...", "en": "...", "jp": "..."}}',
                    'Có nút Rescue Tool để điều chỉnh font, spacing khi bị tràn',
                    'Phù hợp cho phiếu kết quả kiểm nghiệm, giấy chứng nhận tùy chỉnh',
                ],
            },
            {
                icon: '📊',
                name: 'Khớp Đơn Hàng',
                color: 'blue',
                what: 'Upload đơn hàng từ khách hàng + mẫu Excel từ nhà cung cấp → tự động khớp cột → xuất file theo mẫu NCC.',
                steps: [
                    '1. Upload file đơn hàng khách (panel bên trái)',
                    '2. Upload mẫu nhà cung cấp (panel bên phải)',
                    '3. Bấm nút ✨ Auto-Map để AI tự khớp cột',
                    '4. Kiểm tra/chỉnh sửa quy tắc khớp (Rules) ở giữa',
                    '5. Kiểm tra phần Header và Footer — sửa nội dung hoặc formula nếu cần',
                    '6. Bấm 「Tải xuống .xlsx」 để xuất file Excel hoàn chỉnh',
                ],
                tips: [
                    'Cột Row hiện số hàng Excel thực → dễ biết hàng sản phẩm đầu/cuối',
                    'Ô formula hiện dạng =SUM(H19:H24) → có thể sửa trực tiếp',
                    'Lưu Profile: bấm 「Lưu Profile」 để lưu cấu hình, lần sau chọn Profile là dùng được ngay',
                    'Hỗ trợ merge cell, tự xử lý công thức theo số hàng sản phẩm',
                ],
            },
        ],
    },
    en: {
        title: 'DocStudio User Guide',
        subtitle: 'Learn how to use each feature',
        intro: 'DocStudio is a multilingual document toolkit (Vietnamese - English - Japanese). Below is a detailed guide for each tab:',
        tabs: [
            {
                icon: '🏅',
                name: 'Certificates',
                color: 'indigo',
                what: 'Create analysis certificates, QC/QA reports from JSON data.',
                steps: [
                    '1. Click 「System Prompt for Gemini」 on the left panel to copy the prompt',
                    '2. Open Gemini → paste prompt → attach document image',
                    '3. Gemini returns JSON → copy all',
                    '4. Paste JSON into the input field → click 「Load Pages」',
                    '5. Switch language (VN/EN/JP) using the language selector',
                    '6. Click 「Edit」 to edit directly on preview',
                    '7. Click 「Export PDF / Print」 to save',
                ],
                tips: [
                    'SVG stamps are positioned automatically via JSON coordinates',
                    'Overflow warning appears when content exceeds page limits',
                    'Delete page → 3-second Undo window',
                    'Data auto-saves to browser storage',
                ],
            },
            {
                icon: '⚖️',
                name: 'Legal Documents',
                color: 'emerald',
                what: 'Translate and display legal documents (decrees, circulars, decisions...) with professional Markdown formatting.',
                steps: [
                    '1. Click 「System Prompt for Gemini」 to copy the prompt',
                    '2. Open Gemini → paste prompt → attach legal document',
                    '3. Gemini returns JSON → copy all',
                    '4. Paste JSON → click 「Load Document」',
                    '5. Switch language to view VN/EN/JP translations',
                    '6. Click 「Edit」 to modify content (Markdown supported)',
                    '7. Click 「Export PDF / Print」 to save',
                ],
                tips: [
                    'Supports Markdown: headings ##, **bold**, lists, tables',
                    'Long documents (>3000 words): Gemini splits into batches',
                    'Auto-removes Gemini citation markers [cite:...]',
                    'Data auto-saves to browser storage',
                ],
            },
            {
                icon: '✂️',
                name: 'PDF Splitter',
                color: 'rose',
                what: 'Upload a PDF, preview each page, select pages to keep, download individually or merge.',
                steps: [
                    '1. Drag & drop a PDF into the upload area (or click to browse)',
                    '2. View thumbnail previews of each page',
                    '3. Click pages to select/deselect (or use Select All / Deselect)',
                    '4. Click 「Download Individual」 to save each page separately',
                    '5. Or click 「Merge into 1 file」 to combine selected pages',
                ],
                tips: [
                    'Supports drag & drop upload',
                    'Each page shows page number with individual download button',
                    'No login required, fully offline processing',
                ],
            },
            {
                icon: '📂',
                name: 'PDF Merger',
                color: 'violet',
                what: 'Upload multiple PDFs, reorder by drag & drop, merge into a single file.',
                steps: [
                    '1. Drag & drop multiple PDF files into the upload area',
                    '2. Reorder files by dragging them',
                    '3. View page count for each file',
                    '4. Remove unwanted files with ✕ button',
                    '5. Click 「Merge」 to create one PDF',
                ],
                tips: [
                    'Drag to sort files before merging',
                    'Shows total page count after merge',
                    'Processed entirely in browser, no server upload',
                ],
            },
            {
                icon: '🖨️',
                name: 'Template Overlay',
                color: 'fuchsia',
                what: 'Input HTML template + JSON data → live preview → print/export PDF. For custom forms and certificates.',
                steps: [
                    '1. Click 「System Prompt for Gemini」 to copy the HTML recreation prompt',
                    '2. Send prompt + form image to Gemini',
                    '3. Copy HTML part → paste into 「HTML Template」 field',
                    '4. Copy JSON data → paste into 「JSON Data」 field',
                    '5. Preview → adjust font size, spacing if needed',
                    '6. Click directly on preview to edit content',
                    '7. Click 「Print Preview」 to export PDF',
                ],
                tips: [
                    'Use {{key}} in HTML for dynamic data interpolation',
                    'Multilingual data: {"key": {"vn": "...", "en": "...", "jp": "..."}}',
                    'Rescue Tools available for font and spacing adjustments',
                    'Ideal for test result sheets, custom certificates',
                ],
            },
            {
                icon: '📊',
                name: 'Excel Mapping',
                color: 'blue',
                what: 'Upload customer order + supplier template → auto-map columns → export Excel with supplier format.',
                steps: [
                    '1. Upload customer order file (left panel)',
                    '2. Upload supplier template (right panel)',
                    '3. Click ✨ Auto-Map for AI column matching',
                    '4. Review/edit mapping rules in the center',
                    '5. Check Header and Footer zones — edit content or formulas as needed',
                    '6. Click 「Download .xlsx」 to export',
                ],
                tips: [
                    'Row column shows actual Excel row numbers for formula reference',
                    'Formula cells display as =SUM(H19:H24) — editable directly',
                    'Save Profile: save configuration for reuse, load Profile to skip re-uploading template',
                    'Handles merged cells, auto-adjusts formulas based on data rows',
                ],
            },
        ],
    },
    jp: {
        title: 'DocStudio 使い方ガイド',
        subtitle: '各機能の使い方をご紹介',
        intro: 'DocStudioは多言語（ベトナム語・英語・日本語）のドキュメントツールキットです。各タブの詳細ガイド：',
        tabs: [
            {
                icon: '🏅',
                name: '分析票',
                color: 'indigo',
                what: 'JSONデータから試験成績書・分析証明書・QC/QAレポートを作成',
                steps: [
                    '1. 左パネルの「Gemini用プロンプト」をクリックしてコピー',
                    '2. Geminiを開く→プロンプト貼り付け→書類画像を添付',
                    '3. GeminiがJSON返答→全てコピー',
                    '4. 入力欄にJSON貼り付け→「ページ読込」クリック',
                    '5. 言語切替（VN/EN/JP）で翻訳表示',
                    '6.「編集」でプレビュー上で直接編集',
                    '7.「PDF出力/印刷」で保存',
                ],
                tips: [
                    'SVGスタンプはJSON座標で自動配置',
                    'ページ超過時に警告表示',
                    'ページ削除→3秒以内に元に戻す',
                    'データはブラウザに自動保存',
                ],
            },
            {
                icon: '⚖️',
                name: '法的文書',
                color: 'emerald',
                what: '法律文書（政令・通達・決定）の翻訳とMarkdown表示',
                steps: [
                    '1.「Gemini用プロンプト」でプロンプトをコピー',
                    '2. Gemini→プロンプト＋法律文書を送信',
                    '3. JSON返答をコピー',
                    '4. JSON貼り付け→「文書読込」',
                    '5. 言語切替でVN/EN/JP翻訳表示',
                    '6.「編集」でMarkdown編集',
                    '7.「PDF出力/印刷」で保存',
                ],
                tips: [
                    'Markdown対応：見出し##、**太字**、リスト、表',
                    '長文（3000語超）：Geminiがバッチ処理',
                    'Gemini引用マーカー自動削除',
                    'ブラウザに自動保存',
                ],
            },
            {
                icon: '✂️',
                name: 'PDF分割',
                color: 'rose',
                what: 'PDFをアップロード→各ページプレビュー→選択してダウンロードまたは結合',
                steps: [
                    '1. PDFファイルをドラッグ＆ドロップ',
                    '2. 各ページのサムネイルを確認',
                    '3. ページをクリックして選択/解除',
                    '4.「個別ダウンロード」で各ページ保存',
                    '5. または「1ファイルに結合」で選択ページを結合',
                ],
                tips: [
                    'ドラッグ＆ドロップ対応',
                    '各ページに個別ダウンロードボタン',
                    'ログイン不要、完全オフライン処理',
                ],
            },
            {
                icon: '📂',
                name: 'PDF結合',
                color: 'violet',
                what: '複数PDFをアップロード→ドラッグで並べ替え→1ファイルに結合',
                steps: [
                    '1. 複数PDFファイルをドラッグ＆ドロップ',
                    '2. ドラッグで順番を入れ替え',
                    '3. 各ファイルのページ数を確認',
                    '4. 不要なファイルは✕で削除',
                    '5.「結合」で1つのPDFを作成',
                ],
                tips: [
                    'ドラッグで並べ替え可能',
                    '結合後の総ページ数を表示',
                    'ブラウザ内で処理、サーバーへのアップロードなし',
                ],
            },
            {
                icon: '🖨️',
                name: 'テンプレート印刷',
                color: 'fuchsia',
                what: 'HTMLテンプレート＋JSONデータ→ライブプレビュー→PDF出力',
                steps: [
                    '1.「Gemini用プロンプト」でHTML再作成プロンプトをコピー',
                    '2. プロンプト＋フォーム画像をGeminiに送信',
                    '3. HTML部分をコピー→「HTMLテンプレート」に貼り付け',
                    '4. JSONデータをコピー→「JSONデータ」に貼り付け',
                    '5. プレビュー確認→フォントサイズ等調整',
                    '6. プレビュー上でクリックして直接編集',
                    '7.「プレビュー印刷」でPDF出力',
                ],
                tips: [
                    'HTML内の{{key}}で動的データ挿入',
                    '多言語データ：{"key": {"vn": "...", "en": "...", "jp": "..."}}',
                    'フォント・スペース調整用のレスキューツール',
                    '試験結果票やカスタム証明書に最適',
                ],
            },
            {
                icon: '📊',
                name: 'エクセル連携',
                color: 'blue',
                what: '顧客注文書＋サプライヤーテンプレート→自動列マッピング→テンプレート形式でExcel出力',
                steps: [
                    '1. 顧客注文ファイルをアップロード（左パネル）',
                    '2. サプライヤーテンプレートをアップロード（右パネル）',
                    '3. ✨自動マッピングでAI列マッチング',
                    '4. マッピングルールを確認/編集',
                    '5. ヘッダー・フッター確認→数式等を編集',
                    '6.「.xlsxダウンロード」で出力',
                ],
                tips: [
                    'Row列にExcel行番号表示→数式参照が簡単',
                    '数式セルは=SUM(H19:H24)と表示→直接編集可能',
                    'プロファイル保存→次回テンプレート再アップロード不要',
                    '結合セル対応、データ行数に応じて数式自動調整',
                ],
            },
        ],
    },
};

// =====================================================================
// UserGuideView Component
// =====================================================================
const UserGuideView = ({ displayLang = 'vn' }) => {
    const [openTab, setOpenTab] = useState(null);
    const t = guideText[displayLang] || guideText.vn;

    const colorMap = {
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-600', headerBg: 'bg-indigo-100' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-600', headerBg: 'bg-emerald-100' },
        rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-600', headerBg: 'bg-rose-100' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-600', headerBg: 'bg-violet-100' },
        fuchsia: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', badge: 'bg-fuchsia-600', headerBg: 'bg-fuchsia-100' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-600', headerBg: 'bg-blue-100' },
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-12 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
                            <span className="text-2xl">📖</span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">{t.title}</h1>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">{t.subtitle}</p>
                    <p className="text-slate-300 text-xs mt-4 max-w-2xl mx-auto leading-relaxed">{t.intro}</p>
                </div>
            </div>

            {/* Tab Guide Cards */}
            <div className="max-w-4xl mx-auto py-8 px-6 space-y-4">
                {t.tabs.map((tab, idx) => {
                    const colors = colorMap[tab.color] || colorMap.indigo;
                    const isOpen = openTab === idx;

                    return (
                        <div
                            key={idx}
                            className={`rounded-2xl border-2 transition-all shadow-sm overflow-hidden ${isOpen ? `${colors.border} shadow-md` : 'border-slate-200 hover:border-slate-300'}`}
                        >
                            {/* Card Header */}
                            <button
                                onClick={() => setOpenTab(isOpen ? null : idx)}
                                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${isOpen ? colors.headerBg : 'bg-white hover:bg-slate-50'}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isOpen ? colors.badge + ' text-white shadow-md' : 'bg-slate-100'}`}>
                                    {tab.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.badge} text-white uppercase`}>
                                            Tab {idx + 1}
                                        </span>
                                        <h2 className={`font-bold text-base ${isOpen ? colors.text : 'text-slate-700'}`}>{tab.name}</h2>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tab.what}</p>
                                </div>
                                <div className={`transition-transform ${isOpen ? 'rotate-0' : ''}`}>
                                    {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                                </div>
                            </button>

                            {/* Card Body */}
                            {isOpen && (
                                <div className={`px-5 pb-5 pt-3 ${colors.bg}`}>
                                    {/* Steps */}
                                    <div className="mb-4">
                                        <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${colors.text}`}>
                                            {displayLang === 'jp' ? '使い方の手順' : displayLang === 'en' ? 'How to use' : 'Cách sử dụng'}
                                        </h3>
                                        <div className="space-y-1.5">
                                            {tab.steps.map((step, si) => (
                                                <div key={si} className="flex items-start gap-2 bg-white/80 rounded-lg px-3 py-2 text-sm text-slate-700 border border-white/50">
                                                    {step}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tips */}
                                    <div>
                                        <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${colors.text}`}>
                                            <Sparkles size={12} />
                                            {displayLang === 'jp' ? 'ヒント' : displayLang === 'en' ? 'Tips' : 'Mẹo hay'}
                                        </h3>
                                        <div className="grid gap-1.5">
                                            {tab.tips.map((tip, ti) => (
                                                <div key={ti} className="flex items-start gap-2 text-xs text-slate-600 bg-white/60 rounded-lg px-3 py-2 border border-white/40">
                                                    <span className="text-amber-500 shrink-0">💡</span>
                                                    {tip}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-slate-400 text-xs">
                <p>DocStudio © 2026 — AI Document Manager</p>
            </div>
        </div>
    );
};

export default UserGuideView;
