import { useState, useRef, useEffect } from 'react';
import { Type, Search, X, ChevronDown } from 'lucide-react';

// =====================================================================
// Popular Google Fonts — curated list with CJK support
// =====================================================================
const POPULAR_FONTS = [
    { name: 'Times New Roman', family: "'Times New Roman', Times, serif", category: 'serif', builtIn: true },
    { name: 'Inter', family: "'Inter', sans-serif", category: 'sans-serif', builtIn: true },
    { name: 'Arial', family: "'Arial', Helvetica, sans-serif", category: 'sans-serif', builtIn: true },
    { name: 'Georgia', family: "'Georgia', serif", category: 'serif', builtIn: true },
    // Google Fonts
    { name: 'Roboto', family: "'Roboto', sans-serif", category: 'sans-serif' },
    { name: 'Open Sans', family: "'Open Sans', sans-serif", category: 'sans-serif' },
    { name: 'Lato', family: "'Lato', sans-serif", category: 'sans-serif' },
    { name: 'Montserrat', family: "'Montserrat', sans-serif", category: 'sans-serif' },
    { name: 'Source Sans 3', family: "'Source Sans 3', sans-serif", category: 'sans-serif' },
    { name: 'Noto Sans', family: "'Noto Sans', sans-serif", category: 'sans-serif' },
    { name: 'Noto Sans JP', family: "'Noto Sans JP', sans-serif", category: 'sans-serif' },
    { name: 'Noto Serif', family: "'Noto Serif', serif", category: 'serif' },
    { name: 'Noto Serif JP', family: "'Noto Serif JP', serif", category: 'serif' },
    { name: 'Playfair Display', family: "'Playfair Display', serif", category: 'serif' },
    { name: 'Merriweather', family: "'Merriweather', serif", category: 'serif' },
    { name: 'PT Serif', family: "'PT Serif', serif", category: 'serif' },
    { name: 'Libre Baskerville', family: "'Libre Baskerville', serif", category: 'serif' },
    { name: 'Raleway', family: "'Raleway', sans-serif", category: 'sans-serif' },
    { name: 'Poppins', family: "'Poppins', sans-serif", category: 'sans-serif' },
    { name: 'Nunito', family: "'Nunito', sans-serif", category: 'sans-serif' },
    { name: 'Work Sans', family: "'Work Sans', sans-serif", category: 'sans-serif' },
    { name: 'Cabin', family: "'Cabin', sans-serif", category: 'sans-serif' },
    { name: 'Crimson Text', family: "'Crimson Text', serif", category: 'serif' },
    { name: 'EB Garamond', family: "'EB Garamond', serif", category: 'serif' },
    { name: 'Sawarabi Mincho', family: "'Sawarabi Mincho', serif", category: 'serif' },
    { name: 'M PLUS 1p', family: "'M PLUS 1p', sans-serif", category: 'sans-serif' },
    { name: 'IBM Plex Sans', family: "'IBM Plex Sans', sans-serif", category: 'sans-serif' },
    { name: 'IBM Plex Serif', family: "'IBM Plex Serif', serif", category: 'serif' },
    { name: 'Josefin Sans', family: "'Josefin Sans', sans-serif", category: 'sans-serif' },
    { name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif", category: 'serif' },
];

// Track loaded fonts to avoid duplicate <link> tags
const loadedFonts = new Set();

const loadGoogleFont = (fontName) => {
    if (loadedFonts.has(fontName)) return;
    const font = POPULAR_FONTS.find(f => f.name === fontName);
    if (!font || font.builtIn) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(fontName);
};

// =====================================================================
// GoogleFontPicker Component
// =====================================================================
const GoogleFontPicker = ({ currentFont, onFontChange, accentColor = 'indigo' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Focus search on open
    useEffect(() => {
        if (isOpen && searchRef.current) {
            searchRef.current.focus();
        }
    }, [isOpen]);

    const filtered = POPULAR_FONTS.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    // Find current display name
    const currentDisplay = POPULAR_FONTS.find(f => f.family === currentFont)?.name
        || currentFont?.split(',')[0]?.replace(/'/g, '').trim()
        || 'Font';

    const handleSelect = (font) => {
        loadGoogleFont(font.name);
        onFontChange(font.family);
        setIsOpen(false);
        setSearch('');
    };

    const accentMap = {
        indigo: { bg: 'bg-indigo-600', text: 'text-indigo-700', ring: 'ring-indigo-300', hover: 'hover:bg-indigo-50' },
        teal: { bg: 'bg-teal-600', text: 'text-teal-700', ring: 'ring-teal-300', hover: 'hover:bg-teal-50' },
        emerald: { bg: 'bg-emerald-600', text: 'text-emerald-700', ring: 'ring-emerald-300', hover: 'hover:bg-emerald-50' },
        fuchsia: { bg: 'bg-fuchsia-600', text: 'text-fuchsia-700', ring: 'ring-fuchsia-300', hover: 'hover:bg-fuchsia-50' },
    };
    const accent = accentMap[accentColor] || accentMap.indigo;

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all border ${isOpen
                    ? `${accent.bg} text-white shadow-md`
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                title="Chọn Font"
            >
                <Type size={13} />
                <span className="max-w-[80px] truncate">{currentDisplay}</span>
                <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1">
                    {/* Search */}
                    <div className="p-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 transition-all">
                            <Search size={13} className="text-slate-400 shrink-0" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm font..."
                                className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder:text-slate-300"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Font List */}
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                                Không tìm thấy font
                            </div>
                        ) : (
                            filtered.map((font) => {
                                const isActive = font.family === currentFont;
                                // Preload font for preview on hover
                                return (
                                    <button
                                        key={font.name}
                                        onClick={() => handleSelect(font)}
                                        onMouseEnter={() => loadGoogleFont(font.name)}
                                        className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${isActive
                                            ? `bg-indigo-50 ${accent.text}`
                                            : `text-slate-700 hover:bg-slate-50`
                                            }`}
                                    >
                                        <span
                                            className="text-sm truncate"
                                            style={{ fontFamily: font.builtIn ? font.family : `'${font.name}', sans-serif` }}
                                        >
                                            {font.name}
                                        </span>
                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider shrink-0 ml-2">
                                            {font.category === 'serif' ? 'Serif' : 'Sans'}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleFontPicker;
export { POPULAR_FONTS, loadGoogleFont };
