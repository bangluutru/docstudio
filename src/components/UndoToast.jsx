import { useEffect, useRef } from 'react';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';

/**
 * UndoToast — hiện toast "Đã xóa — Hoàn tác" khi xóa trang
 * Props:
 *   visible: boolean
 *   message: string
 *   onUndo: () => void
 *   onDismiss: () => void
 */
const UndoToast = ({ visible, message, onUndo, onDismiss }) => {
    return (
        <div
            className={`fixed bottom-8 right-8 z-[200] transition-all duration-300 ease-out ${visible
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
        >
            <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 min-w-[280px]">
                <div className="w-7 h-7 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                    <X size={14} className="text-red-400" />
                </div>
                <span className="text-sm font-medium flex-grow">{message}</span>
                <button
                    onClick={onUndo}
                    className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-bold text-sm shrink-0 transition-colors"
                >
                    <RotateCcw size={13} />
                    Hoàn tác
                </button>
                <button
                    onClick={onDismiss}
                    className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
                >
                    <X size={14} />
                </button>
            </div>
            {/* Progress bar */}
            {visible && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700 rounded-b-2xl overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 rounded-b-2xl"
                        style={{
                            animation: 'shrink-bar 3s linear forwards',
                        }}
                    />
                </div>
            )}
            <style>{`
        @keyframes shrink-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
        </div>
    );
};

export default UndoToast;
