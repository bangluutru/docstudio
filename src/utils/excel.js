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

// Find footer start row in ExcelJS worksheet (1-indexed)
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
                    // ===== SOURCE: Parse product data, stop at footer =====
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
                    // ===== TARGET TEMPLATE: Extract zone info for UI display =====
                    const ejsWb = new ExcelJS.Workbook();
                    await ejsWb.xlsx.load(data);
                    const ejsWs = ejsWb.worksheets[0];
                    const headerRowNum = headerRowIndex + 1; // ExcelJS is 1-indexed
                    const colCount = ejsWs.columnCount || 20;

                    // Find footer
                    const footerStartRow = findFooterStartInWorksheet(ejsWs, headerRowNum);
                    const existingDataSlots = footerStartRow - headerRowNum - 1;

                    // --- Zone 1: Header (for UI display/editing) ---
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

                    // --- Zone 3: Footer (for UI display/editing) ---
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
                        headers,
                        headerRowIndex,
                        rawBuffer: data,
                        headerZone,
                        footerZone,
                        footerStartRow,
                        existingDataSlots,
                        colCount
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
// 2. Heuristics Auto-Mapping (Offline / Privacy-First)
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

const normalize = (str) => {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
};

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
// 3. Export: MUTATE original template (Option A)
//    - Only touch the data zone between header and footer
//    - Save & restore footer merges around spliceRows to prevent corruption
// =====================================================================

// Helper: Extract merge address components (e.g. "A5:G10" → {top:5, left:1, bottom:10, right:7})
const parseMerge = (mergeRef) => {
    if (typeof mergeRef === 'string') {
        // "A5:G10" format
        const match = mergeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
        if (!match) return null;
        return {
            top: parseInt(match[2]),
            left: colLetterToNum(match[1]),
            bottom: parseInt(match[4]),
            right: colLetterToNum(match[3]),
            ref: mergeRef
        };
    }
    // model object format
    if (mergeRef.model) mergeRef = mergeRef.model;
    if (mergeRef.top !== undefined) return mergeRef;
    return null;
};

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

const makeMergeRef = (top, left, bottom, right) => {
    return `${colNumToLetter(left)}${top}:${colNumToLetter(right)}${bottom}`;
};

export const exportMappedExcel = async ({
    sourceAllRows,
    mappingRules,
    targetBuffer,
    headerRowIndex,
    headerZone,
    footerZone,
    footerStartRow,
    existingDataSlots,
    fileName = 'Mapped_Order.xlsx'
}) => {
    // 1. Load the ORIGINAL template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(targetBuffer);
    const ws = workbook.worksheets[0];

    const headerRowNum = headerRowIndex + 1;
    const dataStartRow = headerRowNum + 1;
    const neededRows = sourceAllRows.length;
    const diff = neededRows - existingDataSlots;

    // 2. Build column map from header row
    const colMap = {};
    const hdrRow = ws.getRow(headerRowNum);
    hdrRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim();
        if (val) colMap[val] = colNumber;
    });

    // 3. Capture the style of the first data row BEFORE any splicing
    const baseDataRowStyles = {};
    const baseRow = ws.getRow(dataStartRow);
    const maxCol = ws.columnCount || 20;
    for (let c = 1; c <= maxCol; c++) {
        const cell = baseRow.getCell(c);
        try {
            baseDataRowStyles[c] = JSON.parse(JSON.stringify(cell.style || {}));
        } catch (e) {
            baseDataRowStyles[c] = {};
        }
    }

    // 4. MERGE PROTECTION: Save all merges at/below data zone, then unmerge them
    const savedMerges = []; // { top, left, bottom, right, zone: 'data'|'footer' }
    const allMergeRefs = [];

    // Collect merge refs from the worksheet's internal model
    if (ws.model && ws.model.merges) {
        allMergeRefs.push(...ws.model.merges);
    }
    // Also check ws._merges
    if (ws._merges) {
        Object.keys(ws._merges).forEach(key => {
            const ref = ws._merges[key];
            const refStr = typeof ref === 'string' ? ref : (ref.model || ref.range || key);
            if (typeof refStr === 'string' && !allMergeRefs.includes(refStr)) {
                allMergeRefs.push(refStr);
            }
        });
    }

    // Parse and separate merges into zones
    allMergeRefs.forEach(ref => {
        const m = parseMerge(ref);
        if (!m) return;
        if (m.top >= dataStartRow) {
            // This merge is in the data zone or footer → save and will unmerge
            savedMerges.push({
                top: m.top,
                left: m.left,
                bottom: m.bottom,
                right: m.right,
                zone: m.top >= footerStartRow ? 'footer' : 'data'
            });
        }
    });

    // Unmerge all saved merges (work backwards to avoid index issues)
    savedMerges.forEach(m => {
        const ref = makeMergeRef(m.top, m.left, m.bottom, m.right);
        try { ws.unMergeCells(ref); } catch (e) { }
    });

    // 5. Adjust data zone size with spliceRows (now safe - no merges to corrupt)
    if (diff > 0) {
        ws.spliceRows(dataStartRow + existingDataSlots, 0, ...new Array(diff).fill([]));
    } else if (diff < 0) {
        ws.spliceRows(dataStartRow + neededRows, Math.abs(diff));
    }

    // 6. Clear all data cells and apply base style
    for (let i = 0; i < neededRows; i++) {
        const row = ws.getRow(dataStartRow + i);
        for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            cell.value = null;
            try { cell.style = baseDataRowStyles[c]; } catch (e) { }
        }
    }

    // 7. Write mapped data
    sourceAllRows.forEach((sourceRow, index) => {
        const row = ws.getRow(dataStartRow + index);
        mappingRules.forEach(rule => {
            if (rule.sourceCol && rule.targetCol && colMap[rule.targetCol]) {
                const colNum = colMap[rule.targetCol];
                const val = sourceRow[rule.sourceCol];
                if (val !== undefined && val !== '') {
                    row.getCell(colNum).value = val;
                }
            }
        });
        row.commit();
    });

    // 8. Re-apply merges AFTER all data is written (critical order!)
    // Extract data zone merge PATTERNS (relative to the first data row)
    const dataZoneMergePatterns = savedMerges
        .filter(m => m.zone === 'data')
        .map(m => ({
            rowOffset: m.top - dataStartRow,
            left: m.left,
            right: m.right,
            bottomOffset: m.bottom - m.top
        }))
        .filter(p => p.bottomOffset === 0); // single-row column merges only

    // Re-apply footer merges (shifted by diff)
    savedMerges.forEach(m => {
        if (m.zone === 'footer') {
            const newTop = m.top + diff;
            const newBottom = m.bottom + diff;
            if (newTop > 0 && newBottom > 0) {
                const newRef = makeMergeRef(newTop, m.left, newBottom, m.right);
                try { ws.mergeCells(newRef); } catch (e) { }
            }
        }
    });

    // Re-apply data zone merge patterns to each new data row
    for (let i = 0; i < neededRows; i++) {
        const currentRowNum = dataStartRow + i;
        dataZoneMergePatterns.forEach(pattern => {
            if (pattern.rowOffset === 0) {
                const ref = makeMergeRef(currentRowNum, pattern.left, currentRowNum, pattern.right);
                try { ws.mergeCells(ref); } catch (e) { }
            }
        });
    }

    // 9. Apply user edits to Zone 1 (Header)
    if (headerZone && headerZone.length > 0) {
        headerZone.forEach(zoneRow => {
            const row = ws.getRow(zoneRow.rowNum);
            zoneRow.cells.forEach(cellData => {
                const existingCell = row.getCell(cellData.col);
                const existingVal = existingCell.value !== null && existingCell.value !== undefined
                    ? String(existingCell.value) : '';
                if (cellData.value !== existingVal && cellData.value.trim() !== '') {
                    existingCell.value = cellData.value;
                }
            });
        });
    }

    // 10. Apply user edits to Zone 3 (Footer)
    if (footerZone && footerZone.length > 0) {
        footerZone.forEach(zoneRow => {
            const newRowNum = zoneRow.rowNum + diff;
            const row = ws.getRow(newRowNum);
            zoneRow.cells.forEach(cellData => {
                const existingCell = row.getCell(cellData.col);
                const existingVal = existingCell.value !== null && existingCell.value !== undefined
                    ? String(existingCell.value) : '';
                if (cellData.value !== existingVal && cellData.value.trim() !== '') {
                    existingCell.value = cellData.value;
                }
            });
        });
    }

    // 11. Fix shared formula corruption
    ws.eachRow((row) => {
        row.eachCell((cell) => {
            const v = cell.value;
            if (v && typeof v === 'object' && v.sharedFormula !== undefined) {
                if (v.formula) {
                    cell.value = { formula: v.formula, result: v.result };
                } else {
                    cell.value = v.result !== undefined ? v.result : '';
                }
            }
        });
    });

    // 12. Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
