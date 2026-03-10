/**
 * DocStudio Export Service
 * Lazy-loads the docx library to generate Word documents from the Schema.
 */

export async function exportDocx(schema, filename = 'DocStudio_Export.docx', layoutConfig = null) {
    if (!schema || !schema.sections || schema.sections.length === 0) {
        throw new Error('Schema is empty. Nothing to export.');
    }

    // Lazy load heavy dependencies
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, Header, Footer, AlignmentType, PageNumber } = await import('docx');
    const { saveAs } = await import('file-saver');

    // Default configuration parsing
    const config = layoutConfig || {
        fontFamily: 'font-sans',
        fontSize: 'text-sm',
        lineSpacing: 'leading-relaxed',
        margins: 'p-[2.5cm]',
        headerOptions: { enabled: false, text: '' },
        footerOptions: { enabled: false, pageNumbers: true }
    };

    const marginMapping = {
        'p-[1.27cm]': 720,   // ~0.5 inch
        'p-[2cm]': 1134,     // ~0.79 inch
        'p-[2.5cm]': 1417,   // ~0.98 inch
        'p-[2.54cm]': 1440   // 1 inch
    };
    const docMargin = marginMapping[config.margins] || 1440;

    const fontMapping = {
        'font-sans': 'Arial',
        'font-serif': 'Times New Roman',
        'font-mono': 'Courier New'
    };
    const docFont = fontMapping[config.fontFamily] || 'Arial';

    const sizeMapping = {
        'text-sm': 22, // 11pt * 2 (half-points in docx)
        'text-base': 24, // 12pt * 2
        'text-lg': 28 // 14pt * 2
    };
    const docSize = sizeMapping[config.fontSize] || 24;

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

                case 'date_field':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: block.text, italics: true, size: 20, color: '64748b' })],
                        alignment: 'right',
                        spacing: { before: 100, after: 100 }
                    }));
                    break;

                case 'closing':
                    children.push(new Paragraph({
                        children: [new TextRun({ text: block.text, bold: true, size: 22 })],
                        alignment: 'right',
                        spacing: { before: 100, after: 100 }
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

    const headers = config.headerOptions.enabled && config.headerOptions.text ? {
        default: new Header({
            children: [
                new Paragraph({
                    children: [new TextRun({ text: config.headerOptions.text, color: '666666', size: 18, allCaps: true })],
                    alignment: AlignmentType.CENTER
                })
            ]
        })
    } : undefined;

    const footers = config.footerOptions.enabled ? {
        default: new Footer({
            children: [
                new Paragraph({
                    children: config.footerOptions.pageNumbers ? [
                        new TextRun("- "),
                        new TextRun({ children: [PageNumber.CURRENT] }),
                        new TextRun(" -")
                    ] : [],
                    alignment: AlignmentType.CENTER,
                    style: "FooterText"
                })
            ]
        })
    } : undefined;

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        size: docSize,
                        font: docFont,
                    },
                    paragraph: {
                        spacing: { line: 276, before: 0, after: 0 }
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: docMargin, right: docMargin, bottom: docMargin, left: docMargin }
                }
            },
            headers: headers,
            footers: footers,
            children: children
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
}
