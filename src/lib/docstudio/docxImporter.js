/**
 * DocStudio DOCX/DOC Importer
 * Uses mammoth.js (lazy-loaded) to extract text from .docx files.
 * Returns raw text string for further processing by formatSuggester.
 */

export async function importDocx(file) {
    // Lazy-load mammoth to avoid adding to initial bundle
    const mammoth = await import('mammoth');

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;

                // Extract raw text preserving structure hints
                const result = await mammoth.convertToHtml({ arrayBuffer });

                // Convert HTML to structured plain text
                const text = htmlToStructuredText(result.value);
                resolve(text);
            } catch (err) {
                console.error('DOCX import error:', err);
                reject(new Error('Không thể đọc file DOCX. Vui lòng kiểm tra file.'));
            }
        };
        reader.onerror = () => reject(new Error('Lỗi đọc file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Convert mammoth HTML output to structured plain text
 * Preserves heading markers and list structure for the suggester
 */
function htmlToStructuredText(html) {
    const lines = [];
    // Create a temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();
        const childText = Array.from(node.childNodes).map(walk).join('');

        switch (tag) {
            case 'h1':
                lines.push(`# ${childText.trim()}`);
                return '';
            case 'h2':
                lines.push(`## ${childText.trim()}`);
                return '';
            case 'h3':
                lines.push(`### ${childText.trim()}`);
                return '';
            case 'h4':
                lines.push(`#### ${childText.trim()}`);
                return '';
            case 'h5':
            case 'h6':
                lines.push(`##### ${childText.trim()}`);
                return '';
            case 'li':
                lines.push(`- ${childText.trim()}`);
                return '';
            case 'p':
                if (childText.trim()) {
                    lines.push(childText.trim());
                } else {
                    lines.push('');
                }
                return '';
            case 'br':
                lines.push('');
                return '';
            case 'table':
                // Extract table as markdown
                extractTable(node, lines);
                return '';
            case 'ul':
            case 'ol':
            case 'tbody':
            case 'thead':
            case 'div':
            case 'span':
            case 'strong':
            case 'em':
            case 'b':
            case 'i':
            case 'u':
                return childText;
            default:
                return childText;
        }
    }

    walk(doc.body);
    return lines.join('\n');
}

/**
 * Extract HTML table to markdown format
 */
function extractTable(tableNode, lines) {
    const rows = tableNode.querySelectorAll('tr');
    rows.forEach((row, idx) => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellTexts = cells.map(c => c.textContent.trim());
        lines.push(`| ${cellTexts.join(' | ')} |`);
        if (idx === 0) {
            lines.push(`| ${cellTexts.map(() => '---').join(' | ')} |`);
        }
    });
}
