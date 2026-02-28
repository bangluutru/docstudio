import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// =====================================================================
// 1. Reading Excel Files
// =====================================================================

// Footer keywords that signal "end of product data"
const FOOTER_KEYWORDS = [
    'subtotal', 'sub total', 'total', 'tax', 'tax rate', 's & h', 's&h',
    'other', 'shipping', 'discount', 'grand total',
    'other comments', 'special instructions', 'comments', 'please provide',
    'certificate', 'note:', 'remark:', 'ghi chú', 'tổng cộng', 'thuế',
    '合計', '税', '小計', '送料', '備考'
];

// Check if a row is a "footer" row (summary/totals/comments area, not a product line)
const isFooterRow = (row, headers) => {
    if (!row || !Array.isArray(row)) return false;

    // Concatenate all cell values and check against footer keywords
    const rowText = row.map(c => String(c).trim().toLowerCase()).join(' ');

    for (const kw of FOOTER_KEYWORDS) {
        if (rowText.includes(kw)) return true;
    }

    // A product row must have a reasonable number of columns filled
    // (at least half of the header count, or at least 3)
    const filledCells = row.filter(c => String(c).trim() !== '').length;
    const minRequired = Math.max(3, Math.floor(headers.length * 0.4));
    if (filledCells < minRequired) return true; // Too sparse, likely footer/summary

    return false;
};

export const readExcelFile = async (file, isSource = true) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON (array of arrays)
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (!jsonData || jsonData.length === 0) {
                    throw new Error("File is empty or invalid format.");
                }

                // Find the actual header row using keyword scoring
                let headerRowIndex = 0;
                let maxScore = -1;
                const headerKeywords = [
                    'no', 'no.', 'stt', 'item', 'item code', 'product', 'pkg', 'unit',
                    'qty', 'quantity', 'price', 'unit price', 'total',
                    'tên', 'mã', 'số lượng', 'đơn giá', 'thành tiền', 'hàng hóa',
                    '数量', '単価', '金額', '品名', '品番', '備考',
                    'item name', 'package', 'item name/package'
                ];

                for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
                    const row = jsonData[i];
                    if (!row || !Array.isArray(row)) continue;

                    let score = 0;
                    const filledCount = row.filter(c => String(c).trim() !== '').length;

                    row.forEach(cell => {
                        const s = String(cell).trim().toLowerCase();
                        if (s.length > 0 && headerKeywords.some(kw => s === kw || s.includes(kw))) {
                            score += 3; // high confidence for known header keywords
                        }
                    });

                    // Bonus for rows with many filled cells (table headers are dense)
                    if (filledCount >= 5) score += 2;

                    if (score > maxScore && score > 0) {
                        maxScore = score;
                        headerRowIndex = i;
                    }
                }

                // Fallback: row with most columns
                if (maxScore <= 0) {
                    let maxCols = 0;
                    for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
                        const row = jsonData[i] || [];
                        const numCols = row.filter(cell => String(cell).trim() !== '').length;
                        if (numCols > maxCols) {
                            maxCols = numCols;
                            headerRowIndex = i;
                        }
                    }
                }

                const rawHeaders = (jsonData[headerRowIndex] || []).map(h => String(h).trim());
                const headers = rawHeaders.filter(h => h !== '');

                if (isSource) {
                    // Parse product data rows, STOP at footer
                    const dataRows = [];
                    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                        const row = jsonData[i];

                        // Stop parsing at the first footer-like row
                        if (isFooterRow(row, headers)) break;

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
                    // For target template: return headers, buffer, and header row index
                    resolve({ headers, headerRowIndex, rawBuffer: data });
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
        // Exact match first (case insensitive)
        if (keywords.some(kw => headerLower === kw.toLowerCase())) {
            return category;
        }
        // Then partial/normalized match
        if (keywords.some(kw => norm.includes(normalize(kw)) || normalize(kw).includes(norm))) {
            return category;
        }
    }
    return null;
};

export const autoMapFields = (sourceHeaders, targetHeaders) => {
    const rules = [];
    const mappedTargets = new Set();
    const mappedSources = new Set();

    // 1. Exact Match (case insensitive)
    sourceHeaders.forEach(s => {
        const exactMatch = targetHeaders.find(t =>
            t.toLowerCase().trim() === s.toLowerCase().trim() && !mappedTargets.has(t)
        );
        if (exactMatch) {
            rules.push({ sourceCol: s, targetCol: exactMatch, type: 'auto' });
            mappedTargets.add(exactMatch);
            mappedSources.add(s);
        }
    });

    // 2. Dictionary / Heuristic Match
    sourceHeaders.forEach(s => {
        if (mappedSources.has(s)) return;
        const sCat = categorize(s);
        if (sCat) {
            const heuristicMatch = targetHeaders.find(t =>
                !mappedTargets.has(t) && categorize(t) === sCat
            );
            if (heuristicMatch) {
                rules.push({ sourceCol: s, targetCol: heuristicMatch, type: 'auto' });
                mappedTargets.add(heuristicMatch);
                mappedSources.add(s);
            }
        }
    });

    return rules;
};

// =====================================================================
// 3. Export Mapped Data (Using ExcelJS to preserve formatting)
// =====================================================================

// Helper: Find where the footer area starts in the template worksheet
const findFooterStartRow = (worksheet, headerRowNumber) => {
    const dataStart = headerRowNumber + 1;

    for (let r = dataStart; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const cells = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
            const v = String(cell.value || '').trim().toLowerCase();
            if (v) cells.push(v);
        });

        const rowText = cells.join(' ');

        // Check if this row contains footer keywords
        for (const kw of FOOTER_KEYWORDS) {
            if (rowText.includes(kw)) return r;
        }
    }

    // No footer found, return row after last
    return worksheet.rowCount + 1;
};

// Helper: Count empty data rows between header and footer in template
const countTemplateDataSlots = (worksheet, headerRowNumber, footerRowNumber) => {
    let count = 0;
    for (let r = headerRowNumber + 1; r < footerRowNumber; r++) {
        count++;
    }
    return count;
};

export const exportMappedExcel = async (
    sourceAllRows,
    targetHeaders,
    mappingRules,
    targetBuffer,
    targetHeaderRowIndex,
    fileName = 'Mapped_Order.xlsx'
) => {
    // 1. Load the original template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(targetBuffer);
    const worksheet = workbook.worksheets[0];

    // 2. Locate the header row (ExcelJS is 1-indexed)
    const headerRowNumber = targetHeaderRowIndex + 1;
    const headerRow = worksheet.getRow(headerRowNumber);

    // Map header names to column numbers
    const colMap = {};
    headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim();
        if (val) colMap[val] = colNumber;
    });

    const dataStartRow = headerRowNumber + 1;

    // 3. Find where the footer starts in the template
    const footerStartRow = findFooterStartRow(worksheet, headerRowNumber);

    // 4. Count existing empty data slots in the template
    const existingSlots = footerStartRow - dataStartRow; // e.g., if header=row 17, footer=row 28, slots=10
    const neededSlots = sourceAllRows.length;
    const diff = neededSlots - existingSlots;

    // 5. Adjust the template: insert or delete rows to fit exactly
    if (diff > 0) {
        // Need MORE rows: insert empty rows right before the footer
        worksheet.spliceRows(footerStartRow, 0, ...new Array(diff).fill([]));

        // Copy style from the first data row to new rows
        const baseRow = worksheet.getRow(dataStartRow);
        for (let i = 0; i < diff; i++) {
            const newRow = worksheet.getRow(footerStartRow + i);
            baseRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                newRow.getCell(colNumber).style = JSON.parse(JSON.stringify(cell.style || {}));
            });
        }
    } else if (diff < 0) {
        // Need FEWER rows: delete excess empty rows from the data area
        const excessCount = Math.abs(diff);
        // Delete rows from the END of the data area (just before footer)
        worksheet.spliceRows(dataStartRow + neededSlots, excessCount);
    }

    // 6. Clear all data cells in the data area first (preserve styles)
    for (let i = 0; i < neededSlots; i++) {
        const row = worksheet.getRow(dataStartRow + i);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // Keep style, clear value
            const style = cell.style;
            cell.value = '';
            cell.style = style;
        });
    }

    // 7. Write mapped data into the rows
    sourceAllRows.forEach((sourceRow, index) => {
        const currentRow = worksheet.getRow(dataStartRow + index);

        mappingRules.forEach(rule => {
            if (rule.sourceCol && rule.targetCol && colMap[rule.targetCol]) {
                const colNum = colMap[rule.targetCol];
                const val = sourceRow[rule.sourceCol];
                if (val !== undefined && val !== '') {
                    currentRow.getCell(colNum).value = val;
                }
            }
        });
        currentRow.commit();
    });

    // 8. Fix exceljs shared formula corruption from spliceRows
    worksheet.eachRow((row) => {
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

    // 9. Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
