/**
 * DocStudio Format Suggester
 * Heuristic engine that analyzes raw text lines and suggests formatting types.
 * Returns an array of suggestions for each text block.
 */

const FORMAT_TYPES = {
    HEADING_1: 'heading_1',
    HEADING_2: 'heading_2',
    HEADING_3: 'heading_3',
    BODY_TEXT: 'body_text',
    LIST_ITEM: 'list_item',
    QUOTE: 'quote',
    SIGNATURE: 'signature',
    DATE_FIELD: 'date_field',
    CLOSING: 'closing',
    PAGE_BREAK: 'page_break',
    TABLE_ROW: 'table_row',
};

export { FORMAT_TYPES };

/**
 * Format type display labels (for UI)
 */
export const FORMAT_LABELS = {
    vn: {
        heading_1: 'Tiêu đề chính (H1)',
        heading_2: 'Tiêu đề phụ (H2)',
        heading_3: 'Tiêu đề mục (H3)',
        body_text: 'Nội dung',
        list_item: 'Danh sách',
        quote: 'Trích dẫn',
        signature: 'Chữ ký',
        date_field: 'Ngày tháng',
        closing: 'Kết thúc',
        page_break: 'Ngắt trang',
        table_row: 'Bảng',
    },
    en: {
        heading_1: 'Main Title (H1)',
        heading_2: 'Section Title (H2)',
        heading_3: 'Subsection (H3)',
        body_text: 'Body Text',
        list_item: 'List Item',
        quote: 'Blockquote',
        signature: 'Signature',
        date_field: 'Date Field',
        closing: 'Closing',
        page_break: 'Page Break',
        table_row: 'Table',
    },
    jp: {
        heading_1: '主題 (H1)',
        heading_2: '節題 (H2)',
        heading_3: '項目 (H3)',
        body_text: '本文',
        list_item: 'リスト',
        quote: '引用',
        signature: '署名',
        date_field: '日付',
        closing: '結び',
        page_break: '改ページ',
        table_row: 'テーブル',
    },
};

/**
 * Badge colors for each format type
 */
export const FORMAT_COLORS = {
    heading_1: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    heading_2: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    heading_3: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    body_text: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
    list_item: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    quote: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    signature: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
    date_field: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    closing: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    page_break: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
    table_row: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
};

/**
 * Analyze raw text and generate format suggestions for each line/block
 * @param {string} rawText - The raw text content
 * @returns {Array<{id: string, lineIndex: number, text: string, suggestedType: string, confidence: 'high'|'medium'|'low'}>}
 */
export function analyzeAndSuggest(rawText) {
    if (!rawText || !rawText.trim()) return [];

    const lines = rawText.split('\n');
    const suggestions = [];
    let foundSignature = false;
    let lineCounter = 0;

    // Pre-scan: find where content starts/ends for context
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    const totalNonEmpty = nonEmptyLines.length;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        lineCounter++;
        const suggestion = analyzeLine(trimmed, i, lineCounter, totalNonEmpty, foundSignature);
        suggestions.push(suggestion);

        if (suggestion.suggestedType === FORMAT_TYPES.SIGNATURE) {
            foundSignature = true;
        }
    }

    return suggestions;
}

/**
 * Analyze a single line and determine its format type
 */
function analyzeLine(text, lineIndex, position, totalLines, afterSignature) {
    const id = `sug_${lineIndex}_${Math.random().toString(36).substring(2, 7)}`;
    const wordCount = text.split(/\s+/).length;

    // ── Already-formatted Markdown detection (high confidence) ──

    // Markdown headings
    const mdHeading = text.match(/^(#{1,6})\s+(.*)$/);
    if (mdHeading) {
        const level = Math.min(mdHeading[1].length, 3);
        return { id, lineIndex, text: mdHeading[2], suggestedType: `heading_${level}`, confidence: 'high' };
    }

    // Markdown lists (bullets only)
    if (/^[-*•]\s+/.test(text)) {
        const cleanText = text.replace(/^[-*•]\s+/, '');
        return { id, lineIndex, text: cleanText, suggestedType: FORMAT_TYPES.LIST_ITEM, confidence: 'high' };
    }

    // Markdown blockquotes
    if (text.startsWith('> ')) {
        return { id, lineIndex, text: text.replace(/^>\s+/, ''), suggestedType: FORMAT_TYPES.QUOTE, confidence: 'high' };
    }

    // Page breaks
    if (text === '---' || text === '***' || text === '___') {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.PAGE_BREAK, confidence: 'high' };
    }

    // Signature marker
    if (text === '::signature::') {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.SIGNATURE, confidence: 'high' };
    }

    // Table row
    if (text.startsWith('|') && text.endsWith('|')) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.TABLE_ROW, confidence: 'high' };
    }

    // ── Heuristic detection (medium/low confidence) ──

    // Signature patterns
    const sigPatterns = /^(Ký\s*(tên|và)|Người\s*(báo\s*cáo|lập|ký|phụ\s*trách)|署名|SIGNED|Reporter|Prepared\s*by|Approved\s*by)/i;
    if (sigPatterns.test(text)) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.SIGNATURE, confidence: 'high' };
    }

    // Date patterns
    const datePatterns = /^(Ngày|Date|日付|Hà Nội,?\s*ngày|TP\.?\s*HCM,?\s*ngày|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i;
    if (datePatterns.test(text) || afterSignature && wordCount <= 8) {
        if (datePatterns.test(text)) {
            return { id, lineIndex, text, suggestedType: FORMAT_TYPES.DATE_FIELD, confidence: 'high' };
        }
    }

    // After signature → closing lines
    if (afterSignature && wordCount <= 10) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.CLOSING, confidence: 'medium' };
    }

    // UPPERCASE short lines → likely heading
    const isUpperCase = text === text.toUpperCase() && /[A-ZÀ-Ỹ]/.test(text);

    // First line / very short UPPERCASE → H1
    if (position <= 2 && wordCount <= 15) {
        if (isUpperCase || wordCount <= 10) {
            return { id, lineIndex, text, suggestedType: FORMAT_TYPES.HEADING_1, confidence: position === 1 ? 'high' : 'medium' };
        }
    }

    // Numbered section headers: I., II., Điều 1:, 第2章, Article 3
    const sectionPattern = /^(I{1,3}V?|V?I{0,3}|[IVX]+|Điều|Mục|Chương|Phần|第|Article|Section|Part)\s+[\dIVX]+\s*[\.:\-]?\s*/i;
    if (sectionPattern.test(text) && wordCount <= 25) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.HEADING_3, confidence: 'high' };
    }

    // Explicit bolding candidates (e.g. bolded short lines acting as sub-sections)
    const boldPattern = /^(1|2|3|4|5|6|7|8|9|10|\d{1,2})\.\s*[A-ZÀ-Ỹ]/i;
    if (boldPattern.test(text) && wordCount <= 12) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.HEADING_3, confidence: 'medium' };
    }

    // Numbered sub-items: a), b), -
    const subItemPattern = /^[a-zđ]\)|^[a-z]\.\s/i;
    if (subItemPattern.test(text)) {
        // We preserve the letter/bullet so legal documents don't lose their a) b) c) flow
        return { id, lineIndex, text: text, suggestedType: FORMAT_TYPES.BODY_TEXT, confidence: 'medium' };
    }

    // Short UPPERCASE lines mid-document → H2
    if (isUpperCase && wordCount <= 15 && wordCount >= 2) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.HEADING_2, confidence: 'medium' };
    }

    // Short non-uppercase but bolding candidates → H3
    if (wordCount <= 8 && wordCount >= 2 && /[A-ZÀ-Ỹ]/.test(text[0]) && !text.endsWith('.') && !text.endsWith(',')) {
        return { id, lineIndex, text, suggestedType: FORMAT_TYPES.HEADING_3, confidence: 'low' };
    }

    // Default: body text
    return { id, lineIndex, text, suggestedType: FORMAT_TYPES.BODY_TEXT, confidence: wordCount > 5 ? 'high' : 'medium' };
}
