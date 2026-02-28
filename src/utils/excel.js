import * as XLSX from 'xlsx';

// =====================================================================
// 1. Reading Excel Files
// =====================================================================
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

                // Convert to JSON
                // header: 1 means array of arrays (first row is headers)
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (!jsonData || jsonData.length === 0) {
                    throw new Error("File is empty or invalid format.");
                }

                // Find the actual header row (skip metadata/company info at the top)
                let headerRowIndex = 0;
                let maxScore = -1;
                const headerKeywords = [
                    'no', 'no.', 'stt', 'item', 'item code', 'product', 'pkg', 'unit',
                    'qty', 'quantity', 'price', 'unit price', 'total', 'subtotal',
                    'tên', 'mã', 'số lượng', 'đơn giá', 'thành tiền', 'hàng hóa',
                    '数量', '単価', '金額', '品名', '品番', '備考'
                ];

                for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
                    const row = jsonData[i];
                    if (!row || !Array.isArray(row)) continue;

                    let score = 0;
                    row.forEach(cell => {
                        const s = String(cell).trim().toLowerCase();
                        if (s.length > 0 && headerKeywords.some(kw => s === kw || s.includes(kw))) {
                            score += 2; // high confidence for known keywords
                        } else if (s.length > 0) {
                            score += 1; // reward rows with many non-empty columns (tables are dense)
                        }
                    });

                    // We want the row with the most column headers
                    if (score > maxScore && score > 0) {
                        maxScore = score;
                        headerRowIndex = i;
                    }
                }

                // If somehow no score was found, fallback to the row with the most columns
                if (maxScore === -1) {
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
                const headers = rawHeaders.filter(h => h !== ''); // filter out empty headers

                if (isSource) {
                    // For source (Customer), keep the data rows too (max 5 for preview)
                    const dataRows = [];
                    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        // Skip completely empty rows
                        if (row && Array.isArray(row)) {
                            // Check how many non-empty cells this row has
                            const filledCells = row.filter(cell => String(cell).trim() !== '').length;

                            // A real table row usually has at least 3-4 columns of data. 
                            // Footer rows (like "Total: $100") often only have 1-2. Let's require at least 2 filled cells.
                            if (filledCells >= 2) {
                                // Convert array row to object based on headers
                                const rowObj = {};
                                headers.forEach((header, colIdx) => {
                                    // Find original column index of this header
                                    const origIdx = rawHeaders.indexOf(header);
                                    if (origIdx !== -1) {
                                        rowObj[header] = row[origIdx] !== undefined ? row[origIdx] : '';
                                    }
                                });
                                dataRows.push(rowObj);
                            }
                        }
                    }
                    // Return all parsed data rows for preview (so users can see all items, not just first 5)
                    resolve({ headers, sampleRows: dataRows, allRows: dataRows });
                } else {
                    // For target (Supplier Template), we only need headers
                    resolve({ headers });
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
// Basic dictionary for common Vietnamese / English / Japanese terms
const mappingDict = {
    // Product Name
    'name': ['name', 'product', 'item', 'tên', 'sản phẩm', 'hàng hóa', '品名', '商品'],
    // Quantity
    'qty': ['qty', 'quantity', 'amount', 'sl', 'số lượng', '数量', '個数'],
    // Price
    'price': ['price', 'unit', 'cost', 'giá', 'đơn giá', '単価', '価格'],
    // Total
    'total': ['total', 'sum', 'tổng', 'thành tiền', '合計', '金額'],
    // Date
    'date': ['date', 'time', 'ngày', 'thời gian', '納期', '日付', '期日'],
    // Code / SKU / PO
    'code': ['code', 'sku', 'po', 'id', 'mã', 'ref', '品番', 'コード', '注文番号'],
    // Note / Remarks
    'note': ['note', 'remark', 'desc', 'ghi chú', '備考', 'メモ']
};

// Helper: Normalize string for comparison (remove accents, spaces, special chars)
const normalize = (str) => {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, ''); // keep only alphanum
};

// Helper: Find which category a header belongs to
const categorize = (header) => {
    const norm = normalize(header);
    for (const [category, keywords] of Object.entries(mappingDict)) {
        // Exact match normalized
        if (keywords.some(kw => norm.includes(normalize(kw)))) {
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
            // Find a target header with the same category
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
// 3. Export Mapped Data
// =====================================================================
export const exportMappedExcel = (sourceAllRows, targetHeaders, mappingRules, fileName = 'Mapped_Order.xlsx') => {
    // Transform data based on rules
    const outputRows = sourceAllRows.map(sourceRow => {
        const outputRow = {};

        // Initialize all target headers with empty string to preserve column order
        targetHeaders.forEach(th => {
            outputRow[th] = '';
        });

        // Fill mapped values
        mappingRules.forEach(rule => {
            // If we have a source column mapped to a target column
            if (rule.sourceCol && rule.targetCol && targetHeaders.includes(rule.targetCol)) {
                // Just copy the value exactly as is
                outputRow[rule.targetCol] = sourceRow[rule.sourceCol] !== undefined ? sourceRow[rule.sourceCol] : '';
            }
        });

        return outputRow;
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(outputRows, { header: targetHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mapped Order");

    // Save via browser download
    XLSX.writeFile(workbook, fileName);
};
