import { useRef } from 'react';
import {
    X,
    Layers,
    BookOpen,
} from 'lucide-react';
import { getLangVal } from '../utils/lang';
import { useOverflowDetect } from '../hooks/useOverflowDetect';
import DeletePageBtn from './DeletePageBtn';
import OverflowWarning from './OverflowWarning';
import ContentLines from './ContentLines';
import CertificatePage from './CertificatePage';

// =====================================================================
// PageCard — a single A4 page with all P0-P2 features baked in
// =====================================================================
const PageCard = ({
    page, index, totalPages, isEditing,
    displayLang, t,
    onEditChange, onDeletePage, onAddLine, onDeleteLine,
    pageRef,
}) => {
    const contentRef = useRef(null);
    const isOverflowing = useOverflowDetect(contentRef);

    const currentTitle = getLangVal(page, 'title', displayLang);
    const currentContent = getLangVal(page, 'content', displayLang, []);

    const isLastPage = index === totalPages - 1;
    const pageType = page.pageType || 'default'; // 'cover' | 'default' | 'appendix' | 'certificate'

    // ── P2-B: Cover page layout ──
    if (pageType === 'cover') {
        return (
            <div
                ref={pageRef}
                className="page-a4 page-font bg-white w-[210mm] h-[297mm] p-[25mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col items-center justify-center text-black border border-slate-100 rounded-sm"
            >
                {/* Delete button — no-print */}
                <button
                    onClick={() => onDeletePage(index)}
                    className="no-print absolute top-4 right-4 w-7 h-7 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                >
                    <X size={13} />
                </button>

                <div className="text-center space-y-6 w-full">
                    {/* Cover badge */}
                    <div className="flex items-center justify-center gap-2 text-indigo-400 mb-8">
                        <Layers size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.coverLabel}</span>
                    </div>

                    {/* Organization */}
                    {(page.organization_vn || page.organization || page[`organization_${displayLang}`]) && (
                        <p className="text-[11pt] font-sans font-semibold text-slate-500 uppercase tracking-widest">
                            {getLangVal(page, 'organization', displayLang)}
                        </p>
                    )}

                    {/* Main Title */}
                    <div className="py-8 border-y-2 border-slate-200 w-full">
                        {isEditing ? (
                            <textarea
                                className="w-full text-center font-black text-3xl uppercase bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-3 text-indigo-900 resize-none rounded font-sans leading-snug"
                                value={currentTitle}
                                rows={3}
                                onChange={(e) => onEditChange(index, `title_${displayLang}`, e.target.value)}
                            />
                        ) : (
                            <h1 className="font-black text-3xl uppercase leading-tight tracking-wide font-sans text-slate-900">
                                {currentTitle}
                            </h1>
                        )}
                    </div>

                    {/* Subtitle / first content line */}
                    {currentContent[0] && (
                        <p className="text-[13pt] text-slate-500 italic font-serif">{currentContent[0]}</p>
                    )}

                    {/* Date */}
                    {page.date && (
                        <p className="text-[11pt] font-sans text-slate-400 mt-8">
                            {t.dateLabel} {page.date}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="absolute bottom-[10mm] left-[25mm] right-[25mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2.5">
                    <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
                    <span className="text-[8pt] font-bold uppercase text-slate-400">{t.page} {index + 1} / {totalPages}</span>
                </div>
            </div>
        );
    }

    // ── P2-B: Appendix page layout ──
    if (pageType === 'appendix') {
        return (
            <div
                ref={pageRef}
                className="page-a4 page-font bg-white w-[210mm] h-[297mm] p-[25mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col text-black border border-slate-100 rounded-sm group"
            >
                <DeletePageBtn onDelete={() => onDeletePage(index)} t={t} />

                {/* Appendix Header */}
                <div className="font-sans mb-8 pb-4 border-b-2 border-slate-200">
                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <BookOpen size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.appendixLabel}</span>
                    </div>
                    <div className="flex justify-between items-start text-slate-400 text-[9px] uppercase tracking-widest">
                        <span>{page.formNo || t.formDefault}</span>
                        <span>{t.appendix}</span>
                    </div>
                </div>

                {/* Title */}
                <div className="mb-8">
                    {isEditing ? (
                        <textarea
                            className="w-full font-bold text-xl uppercase bg-amber-50 border-b-2 border-amber-300 focus:outline-none p-2 text-indigo-900 resize-none rounded font-sans"
                            value={currentTitle}
                            rows={2}
                            onChange={(e) => onEditChange(index, `title_${displayLang}`, e.target.value)}
                        />
                    ) : (
                        <h1 className="font-bold text-xl uppercase font-sans text-slate-800 pl-4 border-l-4 border-amber-400">
                            {currentTitle}
                        </h1>
                    )}
                </div>

                {/* Content */}
                <div ref={contentRef} className="text-[11pt] leading-[1.8] text-justify space-y-3 flex-grow overflow-hidden">
                    <ContentLines
                        lines={currentContent}
                        isEditing={isEditing}
                        pageIndex={index}
                        displayLang={displayLang}
                        onEditChange={onEditChange}
                        onAddLine={onAddLine}
                        onDeleteLine={onDeleteLine}
                        t={t}
                    />
                </div>

                {isOverflowing && !isEditing && <OverflowWarning message={t.overflowWarning} />}

                {/* Footer */}
                <div className="absolute bottom-[10mm] left-[25mm] right-[25mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2.5">
                    <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
                    <span className="text-[8pt] font-bold uppercase text-slate-400">{t.page} {index + 1} / {totalPages}</span>
                </div>
            </div>
        );
    }

    // ── P2-B: Certificate page layout (phiếu phân tích / kiểm nghiệm) ──
    if (pageType === 'certificate') {
        return (
            <CertificatePage
                page={page}
                index={index}
                totalPages={totalPages}
                isEditing={isEditing}
                displayLang={displayLang}
                t={t}
                onEditChange={onEditChange}
                onDeletePage={onDeletePage}
                pageRef={pageRef}
                isOverflowing={isOverflowing}
                contentRef={contentRef}
            />
        );
    }

    // ── Default page layout ──
    return (
        <div
            ref={pageRef}
            className="page-a4 page-font bg-white w-[210mm] h-[297mm] p-[25mm] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] relative flex flex-col text-black border border-slate-100 rounded-sm group"
        >
            {/* P1-A: Per-page Delete */}
            <DeletePageBtn onDelete={() => onDeletePage(index)} t={t} />

            {/* Header */}
            <div className="font-sans flex justify-between items-start mb-8 text-slate-500">
                <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[11px] uppercase tracking-tight opacity-80">
                        {page.formNo || t.formDefault}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest font-medium text-slate-400">
                        {t.internalReport}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[9px] italic text-slate-400">{t.appendix}</span>
                </div>
            </div>

            {/* Main Title */}
            <div className="mb-10">
                {isEditing ? (
                    <textarea
                        className="w-full text-center font-bold text-2xl uppercase bg-amber-50 border-b-2 border-amber-300 focus:bg-amber-100 focus:outline-none p-3 text-indigo-900 resize-none rounded-t-lg font-sans leading-snug"
                        value={currentTitle}
                        rows={2}
                        onChange={(e) => onEditChange(index, `title_${displayLang}`, e.target.value)}
                    />
                ) : (
                    <h1 className="text-center font-bold text-[22pt] uppercase leading-tight underline underline-offset-8 decoration-1 decoration-slate-300 font-sans">
                        {currentTitle}
                    </h1>
                )}
            </div>

            {/* Main Content — P0-A: ref for overflow detection */}
            <div ref={contentRef} className="text-[12pt] leading-[1.8] text-justify space-y-4 flex-grow overflow-hidden">
                <ContentLines
                    lines={currentContent}
                    isEditing={isEditing}
                    pageIndex={index}
                    displayLang={displayLang}
                    onEditChange={onEditChange}
                    onAddLine={onAddLine}
                    onDeleteLine={onDeleteLine}
                    t={t}
                />
            </div>

            {/* P0-A: Overflow Warning */}
            {isOverflowing && !isEditing && <OverflowWarning message={t.overflowWarning} />}

            {/* Signature — only on last page */}
            {isLastPage && (
                <div className="mt-10 grid grid-cols-2 text-center font-sans">
                    <div />
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-[11pt] uppercase tracking-wide">{t.signer}</span>
                        <span className="italic text-[10pt] mt-1 text-slate-400">{t.signDesc}</span>
                        <div className="h-20 w-full" />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-[10mm] left-[25mm] right-[25mm] flex justify-between items-center font-sans border-t border-slate-100 pt-2.5">
                <span className="text-[8pt] uppercase text-slate-300 tracking-widest">DocStudio · AI Document Manager</span>
                <span className="text-[8pt] font-bold uppercase tracking-widest text-slate-400">
                    {t.page} {index + 1} / {totalPages}
                </span>
            </div>
        </div>
    );
};

export default PageCard;
