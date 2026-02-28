import { getLangVal } from '../utils/lang';
import DeletePageBtn from './DeletePageBtn';
import OverflowWarning from './OverflowWarning';

// =====================================================================
// CertificatePage — renders pageType: "certificate"
// Schema: { meta[], table: {headers_*, rows[][]}, content_*, footer_*, judgment }
// =====================================================================
const CertificatePage = ({
    page, index, totalPages, isEditing,
    displayLang, t, onEditChange, onDeletePage,
    pageRef, isOverflowing, contentRef,
}) => {
    const lang = displayLang;
    const currentTitle = getLangVal(page, 'title', lang);
    const currentContent = getLangVal(page, 'content', lang, []);
    const currentFooter = getLangVal(page, 'footer', lang);
    const meta = page.meta || [];

    const tableHeaders = page.table ? getLangVal(page.table, 'headers', lang, []) : [];
    // CORE FIX: Use rows_en/jp/vn if available, fallback to rows, else []
    const tableRows = page.table ? getLangVal(page.table, 'rows', lang, []) : [];

    const handleMetaValueChange = (i, newVal) => {
        const newMeta = meta.map((m, mi) => {
            if (mi !== i) return m;
            // Prefer to update the lang-specific value if it exists, else 'value'
            const key = (`value_${lang}` in m) ? `value_${lang}` : 'value';
            return { ...m, [key]: newVal };
        });
        onEditChange(index, 'meta', newMeta);
    };

    const handleCellChange = (ri, ci, newVal) => {
        const newRows = tableRows.map((row, r) =>
            r === ri ? row.map((cell, c) => c === ci ? newVal : cell) : row
        );

        // Attempt to keep old 'rows' fallback synced if it existed, but prioritize language rows
        const updatedTable = { ...page.table };
        // Always store under the language key to enforce isolation and prevent overwriting
        updatedTable[`rows_${lang}`] = newRows;

        // Also update generic rows if we are on VN to smooth transition for older JSON
        if (lang === 'vn' && updatedTable.rows) {
            updatedTable.rows = newRows;
        }

        onEditChange(index, 'table', updatedTable);
    };

    const handleAddTableRow = () => {
        const emptyRow = tableHeaders.map(() => '');
        const newRows = [...tableRows, emptyRow];

        const updatedTable = { ...page.table };
        updatedTable[`rows_${lang}`] = newRows;
        if (lang === 'vn' && updatedTable.rows) updatedTable.rows = newRows;

        onEditChange(index, 'table', updatedTable);
    };

    const handleDeleteTableRow = (ri) => {
        const newRows = tableRows.filter((_, r) => r !== ri);

        const updatedTable = { ...page.table };
        updatedTable[`rows_${lang}`] = newRows;
        if (lang === 'vn' && updatedTable.rows) updatedTable.rows = newRows;

        onEditChange(index, 'table', updatedTable);
    };

    return (
        <div
            ref={pageRef}
            className="page-a4 page-font bg-white w-[210mm] h-[297mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col text-black border border-slate-100 rounded-sm group"
            style={{ fontFamily: "'Times New Roman', Times, serif", padding: '12mm 15mm 15mm 15mm' }}
        >
            <DeletePageBtn onDelete={() => onDeletePage(index)} t={t} />

            {/* Doc Header — date / recipient line above title (Japanese doc style) */}
            {page.doc_header && (
                <div className="font-sans flex justify-between items-start mb-3 text-[9pt] text-black">
                    <div className="font-normal">{getLangVal(page.doc_header, 'recipient', lang)}</div>
                    <div className="font-normal text-right">{getLangVal(page.doc_header, 'date', lang)}</div>
                </div>
            )}

            {/* Doc Header */}
            <div className="font-sans flex justify-between items-start mb-3 text-[8pt] text-slate-500">
                <div>
                    <div className="font-bold tracking-widest">{getLangVal(page, 'formNo', lang)}</div>
                    <div className="font-normal italic text-slate-400">{getLangVal(page, 'internalReport', lang)}</div>
                </div>
                <div className="text-right italic text-slate-400">
                    {getLangVal(page, 'subtitle', lang)}
                </div>
            </div>

            {/* Certificate badge */}
            {page.showBadge !== false && (
                <div className="flex items-center justify-center gap-2 text-blue-500 mb-2 mt-4">
                    <span className="text-[9px] font-sans font-bold uppercase tracking-widest border border-blue-200 px-3 py-0.5 rounded-full">
                        {getLangVal(page, 'badge', lang, t.certificateLabel)}
                    </span>
                </div>
            )}

            {/* Main Title */}
            <div className="mb-3 text-center relative z-10">
                {isEditing ? (
                    <textarea
                        className="w-full text-center font-bold text-[15pt] bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-1 resize-none rounded font-sans leading-snug"
                        value={currentTitle}
                        rows={2}
                        onChange={(e) => onEditChange(index, `title_${lang}`, e.target.value)}
                    />
                ) : (
                    <h1 className="font-bold text-[15pt] leading-tight border-b-2 border-black inline-block pb-0.5 px-6">
                        {currentTitle}
                    </h1>
                )}
            </div>

            {/* Company Info under title (right aligned) */}
            {page.company_info && (
                <div className="text-right font-sans text-[10.5pt] font-bold mb-6 mr-4 leading-snug relative z-10">
                    <div>{getLangVal(page.company_info, 'name', lang)}</div>
                    <div className="mt-0.5">{getLangVal(page.company_info, 'department', lang)}</div>
                </div>
            )}

            {/* Intro content (optional) */}
            {currentContent.length > 0 && (
                <div className="mb-3 text-[9.5pt] leading-[1.5] italic text-slate-700">
                    {currentContent.map((line, i) => <p key={i}>{line}</p>)}
                </div>
            )}

            {/* Meta table — key/value info block */}
            {meta.length > 0 && (
                <table
                    className={`mb-4 mt-2 border-collapse text-[9.5pt] ${page.meta_half_width ? 'w-[45%]' : 'w-full'}`}
                    style={{ borderColor: '#000' }}
                >
                    <tbody>
                        {meta.map((m, i) => {
                            const label = getLangVal(m, 'label', lang);
                            const rawVal = getLangVal(m, 'value', lang);
                            return (
                                <tr key={i}>
                                    <td
                                        className="border border-black font-bold px-2 py-1 align-top"
                                        style={{ width: '35%', background: '#f5f5f5', fontFamily: 'inherit' }}
                                    >
                                        {label}
                                    </td>
                                    <td
                                        className="border border-black px-2 py-1 align-top"
                                        style={{ fontFamily: 'inherit' }}
                                    >
                                        {isEditing ? (
                                            <input
                                                className="w-full bg-amber-50 border-b border-amber-300 focus:outline-none focus:bg-amber-100 text-[10pt]"
                                                style={{ fontFamily: 'inherit' }}
                                                value={String(rawVal)}
                                                onChange={(e) => handleMetaValueChange(i, e.target.value)}
                                            />
                                        ) : String(rawVal)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {/* Data table — test results */}
            {page.table && (
                <div ref={contentRef} className="flex-grow overflow-hidden">
                    {(getLangVal(page, 'testResultsTitle', lang) || tableHeaders.length > 0) && (
                        <p className="font-bold font-sans text-[10pt] uppercase tracking-wide mb-1.5 border-l-4 border-slate-700 pl-2">
                            {getLangVal(page, 'testResultsTitle', lang, t.testResults)}
                        </p>
                    )}
                    <table
                        className="w-full border-collapse text-[10pt]"
                        style={{ borderColor: '#000' }}
                    >
                        <thead>
                            <tr>
                                {isEditing && <th style={{ width: 24, border: '1px solid #000', background: '#e5e7eb', padding: '4px 6px' }} />}
                                {tableHeaders.map((h, i) => (
                                    <th
                                        key={i}
                                        style={{ border: '1px solid #000', background: '#f3f4f6', fontWeight: 700, padding: '6px 8px', textAlign: 'center', fontFamily: 'inherit' }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((row, ri) => (
                                <tr key={ri}>
                                    {isEditing && (
                                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', width: 24 }}>
                                            <button
                                                onClick={() => handleDeleteTableRow(ri)}
                                                className="text-red-400 hover:text-red-600 text-[10px] font-bold leading-none"
                                                title="Xóa hàng"
                                            >×</button>
                                        </td>
                                    )}
                                    {row.map((cell, ci) => {
                                        // SVG cell: string containing <svg> OR object {svg, size_mm}
                                        const isSvgObj = cell && typeof cell === 'object' && cell.svg;
                                        const isSvgStr = typeof cell === 'string' && cell.trimStart().includes('<svg');
                                        if (isSvgStr || isSvgObj) {
                                            const raw = isSvgObj ? cell.svg : cell;
                                            const defaultSizeMm = (isSvgObj ? cell.size_mm : null) || 13;
                                            // Split multiple SVGs in one string (e.g. 3 stamps side-by-side)
                                            const svgParts = raw.match(/<svg[\s\S]*?<\/svg>/gi) || [raw];
                                            return (
                                                <td
                                                    key={ci}
                                                    style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                                >
                                                    {svgParts.map((svgStr, si) => (
                                                        <div
                                                            key={si}
                                                            style={{
                                                                display: 'inline-block',
                                                                width: `${defaultSizeMm}mm`,
                                                                height: `${defaultSizeMm}mm`,
                                                                verticalAlign: 'middle',
                                                                margin: '0 1px',
                                                            }}
                                                            dangerouslySetInnerHTML={{ __html: svgStr }}
                                                        />
                                                    ))}
                                                </td>
                                            );
                                        }
                                        return (
                                            <td
                                                key={ci}
                                                style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontFamily: 'inherit', fontSize: '9pt' }}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        className="w-full bg-amber-50 border-b border-amber-300 focus:outline-none text-center"
                                                        style={{ fontFamily: 'inherit', minWidth: 40, fontSize: '9pt' }}
                                                        value={cell}
                                                        onChange={(e) => handleCellChange(ri, ci, e.target.value)}
                                                    />
                                                ) : cell}
                                            </td>
                                        );
                                    })}

                                </tr>
                            ))}
                            {isEditing && (
                                <tr>
                                    <td colSpan={(tableHeaders.length || 1) + 1} style={{ border: '1px solid #000', padding: 0 }}>
                                        <button
                                            onClick={handleAddTableRow}
                                            className="w-full py-1.5 text-blue-500 hover:bg-blue-50 font-sans font-bold text-[9pt] transition-colors"
                                        >
                                            {t.addTableRow}
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {isOverflowing && !isEditing && <OverflowWarning message={t.overflowWarning} />}
                </div>
            )}

            {/* Footer note */}
            {currentFooter && (
                <div className="mt-4 pt-2 border-t border-slate-200 text-[9pt] italic text-slate-600">
                    {currentFooter}
                </div>
            )}

            {/* Judgment stamp (CSS fallback — chỉ hiện khi không có stamps[] SVG) */}
            {page.judgment && (!page.stamps || page.stamps.length === 0) && (
                <div className="absolute bottom-[35mm] right-[18mm] rotate-[-10deg] border-4 border-red-600 text-red-600 font-black font-sans text-[13pt] px-3 py-1.5 rounded opacity-75 tracking-widest">
                    {t.judgment}
                </div>
            )}

            {/* SVG Stamps — rendered from stamps[] array */}
            {page.stamps?.map((stamp, i) => {
                const sizeMm = stamp.size_mm || 35;
                const rotation = stamp.rotation ?? -12;
                const opacity = stamp.opacity ?? 0.80;

                let posStyle = {};
                if (stamp.position_x != null && stamp.position_y != null) {
                    posStyle = {
                        left: `${stamp.position_x}%`,
                        top: `${stamp.position_y}%`,
                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    };
                } else {
                    const kwMap = {
                        'bottom-right': { bottom: '18mm', right: '12mm' },
                        'bottom-left': { bottom: '18mm', left: '12mm' },
                        'top-right': { top: '18mm', right: '12mm' },
                        'top-left': { top: '18mm', left: '12mm' },
                        'center': { top: '50%', left: '50%' },
                    };
                    posStyle = kwMap[stamp.position] || kwMap['bottom-right'];
                    posStyle.transform = `${stamp.position === 'center' ? 'translate(-50%,-50%) ' : ''}rotate(${rotation}deg)`;
                }

                return (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            ...posStyle,
                            width: `${sizeMm}mm`,
                            height: `${sizeMm}mm`,
                            opacity,
                            pointerEvents: 'none',
                        }}
                        dangerouslySetInnerHTML={{ __html: stamp.svg }}
                    />
                );
            })}

            {/* Page footer */}
            <div className="absolute bottom-[6mm] left-[15mm] right-[15mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2">
                <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
                <span className="text-[8pt] font-bold uppercase text-slate-400">{t.page} {index + 1} / {totalPages}</span>
            </div>
        </div>
    );
};

export default CertificatePage;
