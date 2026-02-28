import { X } from 'lucide-react';

// P1-A: Delete button shown on hover
const DeletePageBtn = ({ onDelete, t }) => (
    <button
        onClick={onDelete}
        className="no-print absolute top-3 right-3 w-8 h-8 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 z-10"
        title={t.deletePageTitle}
    >
        <X size={14} />
    </button>
);

export default DeletePageBtn;
