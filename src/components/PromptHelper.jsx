import { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';

const PromptHelper = ({ title, promptText, description }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(promptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="shrink-0 border border-sky-200 bg-sky-50 rounded-xl transition-all mb-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left px-3 py-2.5 hover:bg-sky-100 flex items-center justify-between transition-colors outline-none rounded-xl"
            >
                <div className="flex items-center gap-2 text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                    <Sparkles size={12} className={isOpen ? "text-amber-500" : ""} /> {title}
                </div>
                <div className="text-[10px] text-sky-500 font-medium">
                    {isOpen ? 'Đóng lại' : 'Bấm để Copy'}
                </div>
            </button>

            {isOpen && (
                <div className="px-3 pb-3 pt-1">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] text-slate-500 font-medium italic">
                            {description || 'Copy lệnh này gửi cho AI kèm theo hình ảnh/văn bản:'}
                        </p>
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white shadow-sm text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Đã Copy!' : 'Copy'}
                        </button>
                    </div>
                    <div className="text-[9px] font-mono whitespace-pre-wrap text-slate-600 max-h-32 overflow-y-auto p-2 bg-white border border-sky-100 rounded shadow-inner">
                        {promptText}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PromptHelper;
