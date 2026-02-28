import { AlertTriangle } from 'lucide-react';

// P0-A: Overflow warning banner
const OverflowWarning = ({ message }) => (
    <div className="no-print absolute bottom-[20mm] left-[25mm] right-[25mm] flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-700 text-[9pt] font-sans font-semibold px-3 py-2 rounded-lg shadow-sm">
        <AlertTriangle size={13} className="shrink-0 text-amber-500" />
        {message}
    </div>
);

export default OverflowWarning;
