import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import XlsxTemplate from 'xlsx-template';

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
// 3. Export: HYBRID approach (Auto-Tagging + xlsx-template)
//    Step 1: ExcelJS auto-tags template's first data row
//    Step 2: xlsx-template clones rows with perfect formatting
//    Step 3: ExcelJS re-applies zone edits
// =====================================================================


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
    // ── Step 1: Auto-tag the template using ExcelJS ──────────────────

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(targetBuffer);
    const ws = workbook.worksheets[0];

    const headerRowNum = headerRowIndex + 1; // ExcelJS is 1-indexed
    const dataStartRow = headerRowNum + 1;

    // Build column map: headerName → colNumber
    const colMap = {};
    const hdrRow = ws.getRow(headerRowNum);
    hdrRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim();
        if (val) colMap[val] = colNumber;
    });

    // Build reverse mapping: for each target column that has a mapping rule,
    // create a unique property key for the xlsx-template tag
    const tagMap = {}; // colNumber → { propKey, sourceCol }
    mappingRules.forEach((rule, idx) => {
        if (rule.sourceCol && rule.targetCol && colMap[rule.targetCol]) {
            const colNum = colMap[rule.targetCol];
            // Create a safe property name (alphanumeric + underscore)
            const propKey = `f${idx}_${rule.targetCol.replace(/[^a-zA-Z0-9]/g, '_')}`;
            tagMap[colNum] = { propKey, sourceCol: rule.sourceCol };
        }
    });

    // Write tags into the FIRST data row
    const firstDataRow = ws.getRow(dataStartRow);
    Object.entries(tagMap).forEach(([colNumStr, { propKey }]) => {
        const colNum = parseInt(colNumStr);
        const cell = firstDataRow.getCell(colNum);
        cell.value = `\${table:data.${propKey}}`;
    });
    firstDataRow.commit();

    // Remove extra existing data rows (keep only the tagged row)
    // We need to remove rows from dataStartRow+1 to footerStartRow-1
    if (existingDataSlots > 1) {
        // spliceRows(startRow, count) removes 'count' rows starting at 'startRow'
        ws.spliceRows(dataStartRow + 1, existingDataSlots - 1);
    }

    // Apply user edits to Zone 1 (Header) BEFORE generating tagged buffer
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

    // Apply user edits to Zone 3 (Footer)
    // After removing extra data rows, footer shifted up
    const footerShift = existingDataSlots > 1 ? -(existingDataSlots - 1) : 0;
    if (footerZone && footerZone.length > 0) {
        footerZone.forEach(zoneRow => {
            const newRowNum = zoneRow.rowNum + footerShift;
            if (newRowNum > 0) {
                const row = ws.getRow(newRowNum);
                zoneRow.cells.forEach(cellData => {
                    const existingCell = row.getCell(cellData.col);
                    const existingVal = existingCell.value !== null && existingCell.value !== undefined
                        ? String(existingCell.value) : '';
                    if (cellData.value !== existingVal && cellData.value.trim() !== '') {
                        existingCell.value = cellData.value;
                    }
                });
            }
        });
    }

    // Fix shared formula corruption before writing
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

    // Generate the tagged template buffer
    const taggedBuffer = await workbook.xlsx.writeBuffer();

    // ── Step 2: Use xlsx-template to substitute data ─────────────────

    // Build the data array for xlsx-template
    const dataArray = sourceAllRows.map(sourceRow => {
        const obj = {};
        Object.values(tagMap).forEach(({ propKey, sourceCol }) => {
            const val = sourceRow[sourceCol];
            obj[propKey] = val !== undefined && val !== '' ? val : '';
        });
        return obj;
    });

    // Create xlsx-template instance and substitute
    const template = new XlsxTemplate(taggedBuffer, {
        moveImages: true,
        subsituteAllTableRow: true,
        pushDownPageBreakOnTableSubstitution: true
    });

    template.substitute(1, { data: dataArray });

    // Generate final output
    const finalBuffer = template.generate({ type: 'uint8array' });

    // ── Step 3: Download ─────────────────────────────────────────────

    const blob = new Blob([finalBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

