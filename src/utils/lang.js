// =====================================================================
// Shared translation helper (Single Source of Truth)
// =====================================================================
// Extracts a string/array from an object by checking:
// 1. obj[`${baseKey}_${lang}`]
// 2. obj[`${baseKey}_vn`] (fallback)
// 3. obj[baseKey] (no language suffix fallback)
// Returns empty string '' if none found, unless defaultVal is provided.
export const getLangVal = (obj, baseKey, lang, defaultVal = '') => {
    if (!obj) return defaultVal;
    if (obj[`${baseKey}_${lang}`] !== undefined) return obj[`${baseKey}_${lang}`];
    if (obj[`${baseKey}_vn`] !== undefined) return obj[`${baseKey}_vn`];
    if (obj[baseKey] !== undefined) return obj[baseKey];
    return defaultVal;
};
