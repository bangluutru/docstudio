/**
 * DocStudio Markdown to Normalized Schema Parser
 * Translates raw text/markdown into an array of structured blocks.
 */

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

export function parseMarkdownToSchema(markdown) {
    if (!markdown) return { sections: [] };

    const lines = markdown.split('\n');
    const sections = [];

    let currentSection = {
        id: `sec_${generateId()}`,
        type: 'body',
        title: '',
        blocks: []
    };

    let inList = false;
    let currentListBlocks = [];

    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    const flushList = () => {
        if (inList && currentListBlocks.length > 0) {
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'list',
                items: currentListBlocks
            });
            currentListBlocks = [];
            inList = false;
        }
    };

    const flushTable = () => {
        if (inTable && (tableHeaders.length > 0 || tableRows.length > 0)) {
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'table',
                headers: tableHeaders,
                rows: tableRows
            });
            tableHeaders = [];
            tableRows = [];
            inTable = false;
        }
    }

    lines.forEach((line) => {
        const rawLine = line.trim();

        // Skip empty lines, but flush active multi-line blocks
        if (!rawLine) {
            flushList();
            flushTable();
            return;
        }

        // Horizontal Rule -> Page Break
        if (rawLine === '---' || rawLine === '***') {
            flushList();
            flushTable();
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'page_break'
            });
            // Start a new section after page break
            sections.push(currentSection);
            currentSection = {
                id: `sec_${generateId()}`,
                type: 'body',
                title: '',
                blocks: []
            };
            return;
        }

        // Headings
        const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushList();
            flushTable();
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'heading',
                level: headingMatch[1].length,
                text: headingMatch[2]
            });
            return;
        }

        // Blockquotes
        if (rawLine.startsWith('> ')) {
            flushList();
            flushTable();
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'quote',
                text: rawLine.replace(/^>\s+/, '')
            });
            return;
        }

        // Images
        const imgMatch = rawLine.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imgMatch) {
            flushList();
            flushTable();
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'image',
                alt: imgMatch[1],
                url: imgMatch[2]
            });
            return;
        }

        // Lists (Unordered/Ordered)
        const listMatch = rawLine.match(/^([-*]|\d+\.)\s+(.*)$/);
        if (listMatch) {
            flushTable();
            inList = true;
            currentListBlocks.push(listMatch[2]);
            return;
        }

        // Tables
        if (rawLine.startsWith('|') && rawLine.endsWith('|')) {
            flushList();
            const cells = rawLine.split('|').map(c => c.trim()).filter(Boolean);

            // Is this a separator row? (e.g. |---|---|)
            const isSeparator = cells.every(c => /^[-:]+$/.test(c));

            if (isSeparator) {
                // Just ignore it, we assume first row was header
                inTable = true;
                return;
            }

            if (!inTable) {
                inTable = true;
                tableHeaders = cells;
            } else {
                tableRows.push(cells);
            }
            return;
        }

        // Special Commands (e.g. ::signature::)
        if (rawLine === '::signature::') {
            flushList();
            flushTable();
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'signature'
            });
            return;
        }

        // Paragraph
        flushList();
        flushTable();
        currentSection.blocks.push({
            id: `blk_${generateId()}`,
            type: 'paragraph',
            text: rawLine
        });
    });

    flushList();
    flushTable();
    if (currentSection.blocks.length > 0) {
        sections.push(currentSection);
    }

    return { sections };
}

/**
 * Apply accepted format suggestions to generate a schema.
 * Called after user reviews and accepts the suggestions from formatSuggester.
 * @param {Array} suggestions - Array of accepted suggestions with suggestedType
 * @returns {Object} Normalized schema compatible with DocStudioPreview
 */
export function applyFormatSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return { sections: [] };

    const sections = [];
    let currentSection = {
        id: `sec_${generateId()}`,
        type: 'body',
        title: '',
        blocks: []
    };

    let listBuffer = [];

    const flushList = () => {
        if (listBuffer.length > 0) {
            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'list',
                items: [...listBuffer]
            });
            listBuffer = [];
        }
    };

    // Group table_row suggestions into tables
    let tableBuffer = [];
    const flushTable = () => {
        if (tableBuffer.length > 0) {
            const headers = tableBuffer[0];
            const dataRows = tableBuffer.slice(1).filter(row => !/^[\s|:-]+$/.test(row));
            const parseRow = (text) => text.split('|').map(c => c.trim()).filter(Boolean);

            currentSection.blocks.push({
                id: `blk_${generateId()}`,
                type: 'table',
                headers: parseRow(headers),
                rows: dataRows.map(r => parseRow(r))
            });
            tableBuffer = [];
        }
    };

    suggestions.forEach(sug => {
        const { text, suggestedType } = sug;

        // If we hit a non-table/non-list, flush first
        if (suggestedType !== 'list_item') flushList();
        if (suggestedType !== 'table_row') flushTable();

        switch (suggestedType) {
            case 'heading_1':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'heading',
                    level: 1,
                    text
                });
                break;

            case 'heading_2':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'heading',
                    level: 2,
                    text
                });
                break;

            case 'heading_3':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'heading',
                    level: 3,
                    text
                });
                break;

            case 'body_text':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'paragraph',
                    text
                });
                break;

            case 'list_item':
                listBuffer.push(text);
                break;

            case 'quote':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'quote',
                    text
                });
                break;

            case 'signature':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'signature'
                });
                break;

            case 'date_field':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'date_field',
                    text
                });
                break;

            case 'closing':
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'closing',
                    text
                });
                break;

            case 'page_break':
                sections.push(currentSection);
                currentSection = {
                    id: `sec_${generateId()}`,
                    type: 'body',
                    title: '',
                    blocks: []
                };
                break;

            case 'table_row':
                tableBuffer.push(text);
                break;

            default:
                currentSection.blocks.push({
                    id: `blk_${generateId()}`,
                    type: 'paragraph',
                    text
                });
        }
    });

    flushList();
    flushTable();

    if (currentSection.blocks.length > 0) {
        sections.push(currentSection);
    }

    return { sections };
}
