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

// Detect if a row is part of the footer area (not a product data row)
const isFooterRow = (row, headerCount) => {
    if (!row || !Array.isArray(row)) return false;
    const rowText = row.map(c => String(c).trim().toLowerCase()).join(' ');
    for (const kw of FOOTER_KEYWORDS) {
        if (rowText.includes(kw)) return true;
    }
    // Too few filled cells compared to header count = probably not a product row
    const filledCells = row.filter(c => String(c).trim() !== '').length;
    if (filledCells < Math.max(2, Math.floor(headerCount * 0.3))) return true;
    return false;
};

// Scoring algorithm to find the table header row
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

    // Fallback: row with most columns
    if (maxScore <= 0) {
        let maxCols = 0;
        for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
            const row = jsonData[i] || [];
            const numCols = row.filter(c => String(c).trim() !== '').length;
            if (numCols > maxCols) {
                maxCols = numCols;
                bestIndex = i;
            }
        }
    }
    return bestIndex;
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
                    // ===== TARGET TEMPLATE: Extract 3 zones using ExcelJS =====
                    const ejsWb = new ExcelJS.Workbook();
                    await ejsWb.xlsx.load(data);
                    const ejsWs = ejsWb.worksheets[0];

                    // ExcelJS is 1-indexed
                    const headerRowNum = headerRowIndex + 1;

                    // --- Zone 1: Header (rows 1 to headerRow - 1) ---
                    const headerZone = [];
                    for (let r = 1; r < headerRowNum; r++) {
                        const row = ejsWs.getRow(r);
                        const cells = [];
                        const colCount = ejsWs.columnCount || 20;
                        for (let c = 1; c <= colCount; c++) {
                            const cell = row.getCell(c);
                            cells.push({
                                col: c,
                                value: cell.value !== null && cell.value !== undefined ? String(cell.value) : '',
                                style: JSON.parse(JSON.stringify(cell.style || {}))
                            });
                        }
                        headerZone.push({ rowNum: r, cells });
                    }

                    // --- Find footer start: first footer-like row after header ---
                    let footerStartRow = ejsWs.rowCount + 1;
                    // Find the first empty or footer row after the header
                    for (let r = headerRowNum + 1; r <= ejsWs.rowCount; r++) {
                        const row = ejsWs.getRow(r);
                        const values = [];
                        row.eachCell({ includeEmpty: false }, (cell) => {
                            values.push(String(cell.value || '').trim().toLowerCase());
                        });
                        const rowText = values.join(' ');
                        const isFooter = FOOTER_KEYWORDS.some(kw => rowText.includes(kw));
                        if (isFooter) {
                            footerStartRow = r;
                            break;
                        }
                    }

                    // Count existing data slots
                    const existingDataSlots = footerStartRow - headerRowNum - 1;

                    // --- Capture template data row style (from first data row) ---
                    const templateDataRowStyle = [];
                    const firstDataRow = ejsWs.getRow(headerRowNum + 1);
                    const colCount = ejsWs.columnCount || 20;
                    for (let c = 1; c <= colCount; c++) {
                        const cell = firstDataRow.getCell(c);
                        templateDataRowStyle.push({
                            col: c,
                            style: JSON.parse(JSON.stringify(cell.style || {}))
                        });
                    }

                    // --- Capture table header row style ---
                    const tableHeaderRowStyle = [];
                    const hdrRow = ejsWs.getRow(headerRowNum);
                    for (let c = 1; c <= colCount; c++) {
                        const cell = hdrRow.getCell(c);
                        tableHeaderRowStyle.push({
                            col: c,
                            value: cell.value !== null && cell.value !== undefined ? String(cell.value) : '',
                            style: JSON.parse(JSON.stringify(cell.style || {}))
                        });
                    }

                    // --- Zone 3: Footer (rows from footerStartRow to end) ---
                    const footerZone = [];
                    for (let r = footerStartRow; r <= ejsWs.rowCount; r++) {
                        const row = ejsWs.getRow(r);
                        const cells = [];
                        for (let c = 1; c <= colCount; c++) {
                            const cell = row.getCell(c);
                            cells.push({
                                col: c,
                                value: cell.value !== null && cell.value !== undefined ? String(cell.value) : '',
                                style: JSON.parse(JSON.stringify(cell.style || {}))
                            });
                        }
                        footerZone.push({ rowNum: r, cells });
                    }

                    // --- Capture column widths ---
                    const columnWidths = [];
                    for (let c = 1; c <= colCount; c++) {
                        const col = ejsWs.getColumn(c);
                        columnWidths.push({ col: c, width: col.width || 12 });
                    }

                    // --- Capture merges ---
                    const merges = [];
                    if (ejsWs._merges) {
                        Object.values(ejsWs._merges).forEach(m => {
                            merges.push(m.model || m);
                        });
                    }

                    resolve({
                        headers,
                        headerRowIndex,
                        rawBuffer: data,
                        // 3-Zone data
                        headerZone,
                        footerZone,
                        tableHeaderRowStyle,
                        templateDataRowStyle,
                        columnWidths,
                        merges,
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

    // 1. Exact Match
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

    // 2. Heuristic Match
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
// 3. Export: Build NEW workbook from 3 zones
// =====================================================================
export const exportMappedExcel = async ({
    sourceAllRows,
    mappingRules,
    headerZone,
    footerZone,
    tableHeaderRowStyle,
    templateDataRowStyle,
    columnWidths,
    colCount,
    fileName = 'Mapped_Order.xlsx'
}) => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Purchase Order');

    // Set column widths
    columnWidths.forEach(cw => {
        ws.getColumn(cw.col).width = cw.width;
    });

    let currentRow = 1;

    // ===== ZONE 1: Write Header Area =====
    headerZone.forEach(zoneRow => {
        const row = ws.getRow(currentRow);
        zoneRow.cells.forEach(cellData => {
            const cell = row.getCell(cellData.col);
            // Write value (could be edited by user)
            if (cellData.value) {
                // Try to preserve number values
                const num = Number(cellData.value);
                cell.value = (!isNaN(num) && cellData.value.trim() !== '') ? num : cellData.value;
            }
            // Apply original style
            try { cell.style = cellData.style; } catch (e) { }
        });
        row.commit();
        currentRow++;
    });

    // ===== TABLE HEADER ROW =====
    const hdrRow = ws.getRow(currentRow);
    tableHeaderRowStyle.forEach(cellData => {
        const cell = hdrRow.getCell(cellData.col);
        if (cellData.value) cell.value = cellData.value;
        try { cell.style = cellData.style; } catch (e) { }
    });
    hdrRow.commit();
    currentRow++;

    // ===== ZONE 2: Write Mapped Product Data =====
    // Build column map from table header
    const colMap = {};
    tableHeaderRowStyle.forEach(c => {
        if (c.value) colMap[c.value] = c.col;
    });

    sourceAllRows.forEach((sourceRow, index) => {
        const row = ws.getRow(currentRow);

        // Apply template data row style first
        templateDataRowStyle.forEach(cellData => {
            const cell = row.getCell(cellData.col);
            try { cell.style = cellData.style; } catch (e) { }
        });

        // Write mapped values
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
        currentRow++;
    });

    // ===== ZONE 3: Write Footer Area =====
    footerZone.forEach(zoneRow => {
        const row = ws.getRow(currentRow);
        zoneRow.cells.forEach(cellData => {
            const cell = row.getCell(cellData.col);
            if (cellData.value) {
                const num = Number(cellData.value);
                cell.value = (!isNaN(num) && cellData.value.trim() !== '') ? num : cellData.value;
            }
            try { cell.style = cellData.style; } catch (e) { }
        });
        row.commit();
        currentRow++;
    });

    // ===== Download =====
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
