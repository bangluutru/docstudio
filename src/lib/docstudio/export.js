/**
 * DocStudio Export Service
 * Lazy-loads the docx library to generate Word documents from the Schema.
 */

export async function exportDocx(schema, filename = 'DocStudio_Export.docx') {
    if (!schema || !schema.sections || schema.sections.length === 0) {
        throw new Error('Schema is empty. Nothing to export.');
    }

    // Lazy load heavy dependencies
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } = await import('docx');
    const { saveAs } = await import('file-saver');

    const children = [];

    schema.sections.forEach((section, idx) => {
        if (section.title) {
            children.push(new Paragraph({
                text: section.title,
                heading: HeadingLevel.TITLE,
                spacing: { after: 400 }
            }));
        }

        section.blocks.forEach(block => {
            switch (block.type) {
                case 'heading':
                    const headingMapping = {
                        1: HeadingLevel.HEADING_1,
                        2: HeadingLevel.HEADING_2,
                        3: HeadingLevel.HEADING_3,
                        4: HeadingLevel.HEADING_4,
                        5: HeadingLevel.HEADING_5,
                        6: HeadingLevel.HEADING_6
                    };
                    children.push(new Paragraph({
                        text: block.text,
                        heading: headingMapping[block.level] || HeadingLevel.HEADING_1,
                        spacing: { before: 300, after: 120 }
                    }));
                    break;

                case 'paragraph':
                    children.push(new Paragraph({
                        children: [new TextRun(block.text)],
                        spacing: { after: 200 },
                        alignment: 'both' // Justify
                    }));
                    break;

                case 'list':
                    block.items.forEach(item => {
                        children.push(new Paragraph({
                            text: item,
                            bullet: { level: 0 },
                            spacing: { after: 100 }
                        }));
                    });
                    break;

                case 'quote':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: block.text, italics: true })],
                        spacing: { after: 200, before: 100 }
                    }));
                    break;

                case 'table':
                    const tableRows = [];
                    // Header Row
                    tableRows.push(
                        new TableRow({
                            children: block.headers.map(h =>
                                new TableCell({
                                    children: [new Paragraph({ text: h, style: 'Strong' })]
                                })
                            )
                        })
                    );
                    // Data Rows
                    block.rows.forEach(r => {
                        tableRows.push(
                            new TableRow({
                                children: r.map(c => new TableCell({ children: [new Paragraph(c)] }))
                            })
                        )
                    });

                    children.push(new Table({
                        rows: tableRows,
                        width: { size: 100, type: WidthType.PERCENTAGE }
                    }));
                    children.push(new Paragraph({ text: '' })); // Spacer
                    break;

                case 'signature':
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: "Người báo cáo", bold: true })
                        ],
                        alignment: 'right',
                        spacing: { before: 400, after: 1000 }
                    }));
                    break;

                case 'page_break':
                    children.push(new Paragraph({ pageBreakBefore: true }));
                    break;
            }
        });

        // Page break between sections
        if (idx < schema.sections.length - 1) {
            children.push(new Paragraph({ pageBreakBefore: true }));
        }
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch margins
                }
            },
            children: children
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
}
