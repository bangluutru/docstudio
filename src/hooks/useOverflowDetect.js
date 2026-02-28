import { useState, useEffect } from 'react';

// =====================================================================
// Overflow detection hook — watches a DOM element for overflow
// =====================================================================
export function useOverflowDetect(ref) {
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const check = () => {
            setIsOverflowing(el.scrollHeight > el.clientHeight + 2); // 2px tolerance
        };

        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        // Also re-check when content changes (MutationObserver)
        const mutObs = new MutationObserver(check);
        mutObs.observe(el, { childList: true, subtree: true, characterData: true });

        return () => {
            observer.disconnect();
            mutObs.disconnect();
        };
    }, [ref]);

    return isOverflowing;
}
