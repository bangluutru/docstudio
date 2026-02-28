import { useEffect, useRef, useState } from 'react';
import { FileText, GripVertical, BookOpen, Layers } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Icon per page type
const PageTypeIcon = ({ type }) => {
    if (type === 'cover') return <Layers size={11} className="text-indigo-400" />;
    if (type === 'appendix') return <BookOpen size={11} className="text-amber-400" />;
    return <FileText size={11} className="text-slate-400" />;
};

// A single sortable nav item
const SortableNavItem = ({ page, index, isActive, onClick, displayLang }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: String(index) });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const title =
        page[`title_${displayLang}`] || page.title_vn || `Trang ${index + 1}`;
    const shortTitle = title.length > 28 ? title.substring(0, 28) + '…' : title;

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all select-none ${isActive
                ? 'bg-indigo-50 border border-indigo-200'
                : 'hover:bg-slate-50 border border-transparent'
                }`}
        >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 shrink-0 touch-none"
            >
                <GripVertical size={14} />
            </div>

            {/* Page number badge */}
            <div
                className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
            >
                {index + 1}
            </div>

            {/* Page type icon + title */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
                <PageTypeIcon type={page.pageType} />
                <span
                    className={`text-[11px] font-medium truncate ${isActive ? 'text-indigo-700' : 'text-slate-600'
                        }`}
                >
                    {shortTitle}
                </span>
            </div>
        </div>
    );
};

/**
 * PageNavigator — sidebar list of pages with drag-to-reorder
 * Props:
 *   pages: array
 *   pageRefs: MutableRefObject<HTMLElement[]>
 *   displayLang: string
 *   onReorder: (newPages) => void
 */
const PageNavigator = ({ pages, pageRefs, displayLang, onReorder, pageListTitle = 'Danh sách trang' }) => {
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [activeDragId, setActiveDragId] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // IntersectionObserver to track which page is visible
    useEffect(() => {
        const observers = [];
        pageRefs.current.forEach((el, i) => {
            if (!el) return;
            const obs = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) setActivePageIndex(i); },
                { threshold: 0.4 }
            );
            obs.observe(el);
            observers.push(obs);
        });
        return () => observers.forEach((o) => o.disconnect());
    }, [pages.length, pageRefs]);

    const scrollToPage = (index) => {
        const el = pageRefs.current[index];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleDragEnd = (event) => {
        setActiveDragId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = Number(active.id);
        const newIndex = Number(over.id);
        onReorder(arrayMove(pages, oldIndex, newIndex));
    };

    const items = pages.map((_, i) => String(i));

    return (
        <div className="pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">
                {pageListTitle}
            </p>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActiveDragId(e.active.id)}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {pages.map((page, i) => (
                            <SortableNavItem
                                key={i}
                                id={String(i)}
                                index={i}
                                page={page}
                                isActive={activePageIndex === i}
                                onClick={() => scrollToPage(i)}
                                displayLang={displayLang}
                            />
                        ))}
                    </div>
                </SortableContext>
                <DragOverlay>
                    {activeDragId !== null ? (
                        <div className="bg-white border border-indigo-200 rounded-lg px-3 py-2 shadow-xl text-[11px] font-bold text-indigo-700 opacity-90">
                            Trang {Number(activeDragId) + 1}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default PageNavigator;
