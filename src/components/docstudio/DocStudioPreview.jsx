import React from 'react';

// Renders individual blocks based on the schema type
const BlockRenderer = ({ block }) => {
    switch (block.type) {
        case 'heading':
            const Tag = `h${block.level}`;
            const sizeClasses = {
                1: 'text-2xl font-black mt-6 mb-4 text-slate-800',
                2: 'text-xl font-bold mt-5 mb-3 text-slate-800',
                3: 'text-lg font-bold mt-4 mb-2 text-slate-800',
                4: 'text-base font-bold mt-3 mb-2 text-slate-800',
                5: 'text-sm font-bold mt-2 mb-1 text-slate-700',
                6: 'text-sm font-semibold mt-2 mb-1 text-slate-600',
            };
            return <Tag className={sizeClasses[block.level]}>{block.text}</Tag>;

        case 'paragraph':
            return <p className="mb-3 leading-inherit text-slate-800 text-justify">{block.text}</p>;

        case 'list':
            return (
                <ul className="list-disc pl-5 mb-4 text-slate-800 space-y-1">
                    {block.items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            );

        case 'quote':
            return (
                <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 italic mb-4 text-slate-600 bg-slate-50">
                    {block.text}
                </blockquote>
            );

        case 'table':
            return (
                <div className="mb-4 overflow-hidden border border-slate-300">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100">
                            <tr>
                                {block.headers.map((h, i) => (
                                    <th key={i} className="p-2 border border-slate-300 font-bold text-slate-800">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, i) => (
                                <tr key={i}>
                                    {row.map((cell, j) => (
                                        <td key={j} className="p-2 border border-slate-300 text-slate-800">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        case 'signature':
            return (
                <div className="mt-12 flex justify-end mb-16">
                    <div className="text-center w-48">
                        <p className="font-bold text-slate-800 mb-20 uppercase">Người báo cáo</p>
                        <p className="font-medium text-slate-700 border-t border-slate-400 pt-2">(Ký và ghi rõ họ tên)</p>
                    </div>
                </div>
            );

        case 'image':
            return (
                <figure className="mb-4">
                    <img src={block.url} alt={block.alt} className="max-w-full h-auto rounded-lg" />
                    {block.alt && <figcaption className="text-center text-xs text-slate-500 mt-2">{block.alt}</figcaption>}
                </figure>
            );

        case 'page_break':
            return <div className="hidden print:block" style={{ pageBreakAfter: 'always' }} />;

        case 'date_field':
            return (
                <p className="text-slate-500 italic text-right mb-4 mt-2">
                    {block.text}
                </p>
            );

        case 'closing':
            return (
                <p className="font-semibold text-slate-800 text-right mb-2 uppercase tracking-wide">
                    {block.text}
                </p>
            );

        default:
            return <div className="text-red-500 text-xs p-2 border border-red-200 bg-red-50 mb-2">Unsupported block: {block.type}</div>;
    }
};

export default function DocStudioPreview({ schema, layoutConfig }) {
    const config = layoutConfig || {
        fontFamily: 'font-sans',
        fontSize: 'text-sm',
        lineSpacing: 'leading-relaxed',
        margins: 'p-[2.5cm]',
        headerOptions: { enabled: false, text: '' },
        footerOptions: { enabled: false, pageNumbers: true }
    };

    if (!schema || !schema.sections || schema.sections.length === 0) {
        return (
            <div className={`bg-white w-full max-w-[210mm] min-h-[297mm] shadow-[0_0_15px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center ${config.margins}`}>
                <p className="text-slate-400 text-center italic">Document preview will appear here.</p>
            </div>
        );
    }

    const containerClasses = `bg-white w-full max-w-[210mm] min-h-[297mm] shadow-[0_0_15px_rgba(0,0,0,0.1)] mx-auto transition-all print:shadow-none print:p-0 relative flex flex-col ${config.fontFamily} ${config.fontSize} ${config.lineSpacing} ${config.margins}`;
    const marginSize = config.margins.match(/\[(.*?)\]/)?.[1] || '2.5cm';

    return (
        <div className={containerClasses}>
            <style>{`
                @media print {
                    @page { margin: ${marginSize} !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>

            {/* Header Rendering */}
            {config.headerOptions.enabled && (
                <div className="absolute top-4 left-0 w-full text-center print:fixed print:top-4 opacity-50 text-[0.8em] uppercase tracking-widest font-bold">
                    {config.headerOptions.text}
                </div>
            )}

            <div className="flex-1 flex flex-col relative z-0">
                {schema.sections.map((section, idx) => (
                    <div key={section.id} className="mb-8 flex-1">
                        {section.title && <h1 className="text-3xl font-black mb-6 text-slate-900">{section.title}</h1>}
                        {section.blocks.map(block => (
                            <BlockRenderer key={block.id} block={block} />
                        ))}

                        {idx < schema.sections.length - 1 && (
                            <div className="page-break-indicator border-t-2 border-dashed border-slate-300 my-8 print:hidden" />
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Rendering */}
            {config.footerOptions.enabled && (
                <div className="absolute bottom-4 left-0 w-full flex justify-center items-center print:fixed print:bottom-4 opacity-50 text-[0.8em]">
                    {config.footerOptions.pageNumbers && (
                        <span>- 1 -</span> // For HTML preview we mock page 1. Print adds native headers/footers usually, or CSS counters.
                    )}
                </div>
            )}
        </div>
    );
}
