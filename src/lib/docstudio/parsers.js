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
