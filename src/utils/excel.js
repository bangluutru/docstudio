import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// =====================================================================
// Constants
// =====================================================================
const FOOTER_KEYWORDS = [
    'subtotal', 'sub total', 'total', 'tax', 'tax rate', 's & h', 's&h',
    'other', 'shipping', 'discount', 'grand total',
    'other comments', 'special instructions', 'comments', 'please provide',
    'certificate', 'ghi chú', 'tổng cộng', 'thuế',
    '合計', '税', '小計', '送料', '備考'
];

// =====================================================================
// 1. Reading Excel Files
// =====================================================================

const isFooterRow = (row, headerCount) => {
    if (!row || !Array.isArray(row)) return false;
    const rowText = row.map(c => String(c).trim().toLowerCase()).join(' ');
    for (const kw of FOOTER_KEYWORDS) {
        if (rowText.includes(kw)) return true;
    }
    const filledCells = row.filter(c => String(c).trim() !== '').length;
    if (filledCells < Math.max(2, Math.floor(headerCount * 0.3))) return true;
    return false;
};

const findHeaderRow = (jsonData) => {
    const headerKeywords = [
        'no', 'no.', 'stt', 'item', 'item code', 'product', 'pkg', 'unit',
        'qty', 'quantity', 'price', 'unit price', 'total',
        'tên', 'mã', 'số lượng', 'đơn giá', 'thành tiền', 'hàng hóa',
        '数量', '単価', '金額', '品名', '品番', '備考',
        'item name', 'package', 'item name/package'
    ];

    let bestIndex = 0;
    let maxScore = -1;

    for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;
        let score = 0;
        row.forEach(cell => {
            const s = String(cell).trim().toLowerCase();
            if (s.length > 0 && headerKeywords.some(kw => s === kw || s.includes(kw))) {
                score += 3;
            }
        });
        const filledCount = row.filter(c => String(c).trim() !== '').length;
        if (filledCount >= 5) score += 2;
        if (score > maxScore && score > 0) {
            maxScore = score;
            bestIndex = i;
        }
    }

    if (maxScore <= 0) {
        let maxCols = 0;
        for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
            const row = jsonData[i] || [];
            const numCols = row.filter(c => String(c).trim() !== '').length;
            if (numCols > maxCols) { maxCols = numCols; bestIndex = i; }
        }
    }
    return bestIndex;
};

const findFooterStartInWorksheet = (ejsWs, headerRowNum) => {
    for (let r = headerRowNum + 1; r <= ejsWs.rowCount; r++) {
        const row = ejsWs.getRow(r);
        const values = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
            values.push(String(cell.value || '').trim().toLowerCase());
        });
        const rowText = values.join(' ');
        if (FOOTER_KEYWORDS.some(kw => rowText.includes(kw))) {
            return r;
        }
    }
    return ejsWs.rowCount + 1;
};

export const readExcelFile = async (file, isSource = true) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (!jsonData || jsonData.length === 0) {
                    throw new Error("File is empty or invalid format.");
                }

                const headerRowIndex = findHeaderRow(jsonData);
                const rawHeaders = (jsonData[headerRowIndex] || []).map(h => String(h).trim());
                const headers = rawHeaders.filter(h => h !== '');

                if (isSource) {
                    const dataRows = [];
                    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (isFooterRow(row, headers.length)) break;
                        if (row && Array.isArray(row)) {
                            const rowObj = {};
                            headers.forEach((header) => {
                                const origIdx = rawHeaders.indexOf(header);
                                if (origIdx !== -1) {
                                    rowObj[header] = row[origIdx] !== undefined ? row[origIdx] : '';
                                }
                            });
                            dataRows.push(rowObj);
                        }
                    }
                    resolve({ headers, sampleRows: dataRows, allRows: dataRows });
                } else {
                    const ejsWb = new ExcelJS.Workbook();
                    await ejsWb.xlsx.load(data);
                    const ejsWs = ejsWb.worksheets[0];
                    const headerRowNum = headerRowIndex + 1;
                    const colCount = ejsWs.columnCount || 20;

                    const footerStartRow = findFooterStartInWorksheet(ejsWs, headerRowNum);
                    const existingDataSlots = footerStartRow - headerRowNum - 1;

                    const headerZone = [];
                    for (let r = 1; r < headerRowNum; r++) {
                        const row = ejsWs.getRow(r);
                        const cells = [];
                        for (let c = 1; c <= colCount; c++) {
                            const cell = row.getCell(c);
                            cells.push({
                                col: c,
                                value: cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
                            });
                        }
                        headerZone.push({ rowNum: r, cells });
                    }

                    const footerZone = [];
                    for (let r = footerStartRow; r <= ejsWs.rowCount; r++) {
                        const row = ejsWs.getRow(r);
                        const cells = [];
                        for (let c = 1; c <= colCount; c++) {
                            const cell = row.getCell(c);
                            cells.push({
                                col: c,
                                value: cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
                            });
                        }
                        footerZone.push({ rowNum: r, cells });
                    }

                    resolve({
                        headers, headerRowIndex, rawBuffer: data,
                        headerZone, footerZone, footerStartRow,
                        existingDataSlots, colCount
                    });
                }
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

// =====================================================================
// 2. Heuristics Auto-Mapping
// =====================================================================
const mappingDict = {
    'name': ['name', 'product', 'item', 'item name', 'package', 'item name/package',
        'tên', 'sản phẩm', 'hàng hóa', '品名', '商品'],
    'qty': ['qty', 'quantity', 'amount', 'sl', 'số lượng', '数量', '個数'],
    'price': ['price', 'unit price', 'cost', 'giá', 'đơn giá', '単価', '価格'],
    'total': ['total', 'sum', 'tổng', 'thành tiền', '合計', '金額'],
    'date': ['date', 'time', 'ngày', 'thời gian', '納期', '日付', '期日'],
    'code': ['code', 'sku', 'item code', 'po', 'id', 'mã', 'ref', '品番', 'コード', '注文番号'],
    'note': ['note', 'remark', 'desc', 'ghi chú', '備考', 'メモ'],
    'no': ['no', 'no.', 'stt', '#'],
    'pkg': ['pkg', 'package', 'packing', 'đóng gói', '包装'],
    'unit': ['unit', 'đơn vị', '単位']
};

const normalize = (str) =>
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

const categorize = (header) => {
    const headerLower = header.toLowerCase().trim();
    const norm = normalize(header);
    for (const [category, keywords] of Object.entries(mappingDict)) {
        if (keywords.some(kw => headerLower === kw.toLowerCase())) return category;
        if (keywords.some(kw => norm.includes(normalize(kw)) || normalize(kw).includes(norm))) return category;
    }
    return null;
};

export const autoMapFields = (sourceHeaders, targetHeaders) => {
    const rules = [];
    const mappedTargets = new Set();
    const mappedSources = new Set();

    sourceHeaders.forEach(s => {
        const match = targetHeaders.find(t =>
            t.toLowerCase().trim() === s.toLowerCase().trim() && !mappedTargets.has(t)
        );
        if (match) {
            rules.push({ sourceCol: s, targetCol: match, type: 'auto' });
            mappedTargets.add(match);
            mappedSources.add(s);
        }
    });

    sourceHeaders.forEach(s => {
        if (mappedSources.has(s)) return;
        const sCat = categorize(s);
        if (sCat) {
            const match = targetHeaders.find(t =>
                !mappedTargets.has(t) && categorize(t) === sCat
            );
            if (match) {
                rules.push({ sourceCol: s, targetCol: match, type: 'auto' });
                mappedTargets.add(match);
                mappedSources.add(s);
            }
        }
    });

    return rules;
};

// =====================================================================
// 3. Export: ExcelJS Engine with Merge Protection
//    Order: Save → Unmerge → Splice → Clear → Write → Re-merge LAST
// =====================================================================

const colLetterToNum = (letters) => {
    let n = 0;
    for (let i = 0; i < letters.length; i++) {
        n = n * 26 + (letters.charCodeAt(i) - 64);
    }
    return n;
};

const colNumToLetter = (num) => {
    let s = '';
    while (num > 0) {
        const rem = (num - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        num = Math.floor((num - 1) / 26);
    }
    return s;
};

const makeMergeRef = (top, left, bottom, right) =>
    `${colNumToLetter(left)}${top}:${colNumToLetter(right)}${bottom}`;

const parseMerge = (ref) => {
    if (typeof ref === 'string') {
        const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!m) return null;
        return { top: +m[2], left: colLetterToNum(m[1]), bottom: +m[4], right: colLetterToNum(m[3]) };
    }
    if (ref?.model) ref = ref.model;
    return ref?.top !== undefined ? ref : null;
};

const collectAllMerges = (ws) => {
    const refs = [];
    if (ws.model?.merges) refs.push(...ws.model.merges);
    if (ws._merges) {
        Object.keys(ws._merges).forEach(key => {
            const r = ws._merges[key];
            const s = typeof r === 'string' ? r : (r.model || r.range || key);
            if (typeof s === 'string' && !refs.includes(s)) refs.push(s);
        });
    }
    return refs;
};

export const exportMappedExcel = async ({
    sourceAllRows, mappingRules, targetBuffer, headerRowIndex,
    headerZone, footerZone, footerStartRow, existingDataSlots,
    fileName = 'Mapped_Order.xlsx'
}) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(targetBuffer);
    const ws = workbook.worksheets[0];

    const headerRowNum = headerRowIndex + 1;
    const dataStartRow = headerRowNum + 1;
    const neededRows = sourceAllRows.length;
    const diff = neededRows - existingDataSlots;
    const maxCol = ws.columnCount || 20;

    // 1. Column map (merge-aware: always use leftmost column of merged headers)
    const colMap = {};
    ws.getRow(headerRowNum).eachCell((cell, cn) => {
        const v = String(cell.value || '').trim();
        if (v) colMap[v] = cn;
    });

    // Fix: For merged header cells, remap to leftmost column
    const headerMerges = collectAllMerges(ws).map(parseMerge).filter(Boolean);
    headerMerges.forEach(m => {
        if (m.top <= headerRowNum && m.bottom >= headerRowNum) {
            // This merge covers the header row
            // Find if any colMap entry points to a column within this merge
            Object.keys(colMap).forEach(header => {
                const col = colMap[header];
                if (col >= m.left && col <= m.right) {
                    // Remap to leftmost column of the merge
                    colMap[header] = m.left;
                }
            });
        }
    });

    // 2. Base styles
    const baseStyles = {};
    for (let c = 1; c <= maxCol; c++) {
        try { baseStyles[c] = JSON.parse(JSON.stringify(ws.getRow(dataStartRow).getCell(c).style || {})); }
        catch (e) { baseStyles[c] = {}; }
    }

    // 3. Save merges in data/footer zones
    const saved = [];
    collectAllMerges(ws).forEach(ref => {
        const m = parseMerge(ref);
        if (!m || m.top < dataStartRow) return;
        saved.push({ ...m, zone: m.top >= footerStartRow ? 'footer' : 'data' });
    });

    // 4. Unmerge all
    saved.forEach(m => {
        try { ws.unMergeCells(makeMergeRef(m.top, m.left, m.bottom, m.right)); } catch (e) { }
    });

    // 5. Splice
    if (diff > 0) ws.spliceRows(dataStartRow + existingDataSlots, 0, ...new Array(diff).fill([]));
    else if (diff < 0) ws.spliceRows(dataStartRow + neededRows, Math.abs(diff));

    // 6. Clear + style
    for (let i = 0; i < neededRows; i++) {
        const row = ws.getRow(dataStartRow + i);
        for (let c = 1; c <= maxCol; c++) {
            row.getCell(c).value = null;
            try { row.getCell(c).style = baseStyles[c]; } catch (e) { }
        }
    }

    // 7. Write data
    sourceAllRows.forEach((src, idx) => {
        const row = ws.getRow(dataStartRow + idx);
        mappingRules.forEach(rule => {
            if (rule.sourceCol && rule.targetCol && colMap[rule.targetCol]) {
                const val = src[rule.sourceCol];
                if (val !== undefined && val !== '') row.getCell(colMap[rule.targetCol]).value = val;
            }
        });
        row.commit();
    });

    // 8. Re-merge LAST
    // 8a. Data patterns (from first template data row only, single-row merges)
    const patterns = saved
        .filter(m => m.zone === 'data' && m.top === dataStartRow && m.bottom === m.top)
        .map(m => ({ left: m.left, right: m.right }));

    for (let i = 0; i < neededRows; i++) {
        const r = dataStartRow + i;
        patterns.forEach(p => { try { ws.mergeCells(makeMergeRef(r, p.left, r, p.right)); } catch (e) { } });
    }

    // 8b. Footer merges shifted by diff
    saved.filter(m => m.zone === 'footer').forEach(m => {
        const t = m.top + diff, b = m.bottom + diff;
        if (t > 0 && b > 0) { try { ws.mergeCells(makeMergeRef(t, m.left, b, m.right)); } catch (e) { } }
    });

    // 9. Header zone edits
    if (headerZone?.length > 0) {
        headerZone.forEach(zr => {
            const row = ws.getRow(zr.rowNum);
            zr.cells.forEach(cd => {
                const ex = String(row.getCell(cd.col).value ?? '');
                if (cd.value !== ex && cd.value.trim()) row.getCell(cd.col).value = cd.value;
            });
        });
    }

    // 10. Footer zone edits
    if (footerZone?.length > 0) {
        footerZone.forEach(zr => {
            const nr = zr.rowNum + diff;
            if (nr > 0) {
                const row = ws.getRow(nr);
                zr.cells.forEach(cd => {
                    const ex = String(row.getCell(cd.col).value ?? '');
                    if (cd.value !== ex && cd.value.trim()) row.getCell(cd.col).value = cd.value;
                });
            }
        });
    }

    // 11. Adjust formulas: rebuild data-zone ranges + shift footer refs
    const oldDataEnd = dataStartRow + existingDataSlots - 1;
    const newDataEnd = dataStartRow + neededRows - 1;

    ws.eachRow(row => {
        row.eachCell(cell => {
            const v = cell.value;
            if (!v) return;

            // Fix shared formula corruption first
            if (typeof v === 'object' && v.sharedFormula !== undefined) {
                cell.value = v.formula ? { formula: v.formula, result: v.result } : (v.result ?? '');
                return;
            }

            let formula = null;
            if (typeof v === 'object' && v.formula) {
                formula = v.formula;
            } else if (typeof v === 'string' && v.startsWith('=')) {
                formula = v.substring(1);
            }
            if (!formula) return;

            // Pass 1: Fix RANGE references (e.g. SUM(G8:G12) → SUM(G8:G13))
            // Detect ranges that overlap the original data zone and rebuild them
            let adjusted = formula.replace(
                /(\$?[A-Z]+\$?)(\d+):(\$?[A-Z]+\$?)(\d+)/gi,
                (match, colRef1, row1Str, colRef2, row2Str) => {
                    const r1 = parseInt(row1Str);
                    const r2 = parseInt(row2Str);

                    // Range covers the original data zone → rebuild with new boundaries
                    if (r1 >= dataStartRow && r1 <= oldDataEnd &&
                        r2 >= dataStartRow && r2 <= oldDataEnd) {
                        return `${colRef1}${dataStartRow}:${colRef2}${newDataEnd}`;
                    }

                    // Range entirely in footer zone → shift both ends by diff
                    if (r1 >= footerStartRow && r2 >= footerStartRow && diff !== 0) {
                        return `${colRef1}${r1 + diff}:${colRef2}${r2 + diff}`;
                    }

                    return match;
                }
            );

            // Pass 2: Fix STANDALONE references (not part of a range)
            // Only shift refs to footer cells (>= original footerStartRow)
            if (diff !== 0) {
                adjusted = adjusted.replace(
                    /(\$?[A-Z]+\$?)(\d+)(?![\d:])/gi,
                    (match, colRef, rowStr) => {
                        const rowNum = parseInt(rowStr);
                        if (rowNum >= footerStartRow) {
                            const newRow = rowNum + diff;
                            if (newRow > 0) return `${colRef}${newRow}`;
                        }
                        return match;
                    }
                );
            }

            if (adjusted !== formula) {
                if (typeof v === 'object') {
                    cell.value = { formula: adjusted, result: v.result };
                } else {
                    cell.value = { formula: adjusted };
                }
            }
        });
    });

    // 12. Remove extra sheets (keep only the first one)
    while (workbook.worksheets.length > 1) {
        workbook.removeWorksheet(workbook.worksheets[workbook.worksheets.length - 1].id);
    }

    // 13. Download
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
};
