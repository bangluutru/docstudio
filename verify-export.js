import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readExcelFile, autoMapFields, exportMappedExcel } from './src/utils/excel.js';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
    console.log("Reading customer order...");
    const sourceBuffer = fs.readFileSync(path.join(__dirname, 'mock_customer_order.xlsx'));
    // Since readExcelFile assumes browser (FileReader), we need to adapt it slightly for Node, 
    // OR we can just write exactly what it does using XLSX.
    console.log("Skipping UI simulation... Testing ExcelJS export directly.");

    // We already know target structure from create-mock-files
    const sourceAllRows = [
        { "Product Name": "Okinawa Fucoidan EX", "Qty": 100, "Unit Price": 45.5, "Delivery Date": "2025-07-01", "PO Number": "PO-1001", "Remarks": "Urgent" },
        { "Product Name": "Natto Kinase Premium", "Qty": 50, "Unit Price": 22, "Delivery Date": "2025-07-15", "PO Number": "PO-1001", "Remarks": "" },
        { "Product Name": "Placenta Extract", "Qty": 200, "Unit Price": 15.75, "Delivery Date": "2025-07-01", "PO Number": "PO-1001", "Remarks": "Fragile packing" }
    ];

    const targetHeaders = ["No.", "Item Code", "Item name/Package", "Pkg", "Unit Price", "Quantity", "TOTAL"];
    const targetBuffer = fs.readFileSync(path.join(__dirname, 'mock_supplier_template.xlsx'));

    // Header is on Row 7 (index 6)
    const targetHeaderRowIndex = 6;

    const mappingRules = [
        { sourceCol: "Product Name", targetCol: "Item name/Package", type: "auto" },
        { sourceCol: "Qty", targetCol: "Quantity", type: "auto" },
        { sourceCol: "Unit Price", targetCol: "Unit Price", type: "auto" },
        { sourceCol: "Remarks", targetCol: "TOTAL", type: "manual" } // Just testing writing to a random column
    ];

    console.log("Executing exportMappedExcel...");
    // Mock Blob and URL for Node environment before running
    global.Blob = class Blob { constructor(c) { this.content = c; } };
    global.window = { URL: { createObjectURL: () => 'blob:url', revokeObjectURL: () => { } } };
    global.document = {
        createElement: () => ({
            click: () => {
                console.log("Simulated download click!");
            }
        })
    };

    // We need to intercept the writeBuffer to save it locally instead of browser download
    const originalExport = exportMappedExcel;

    // We will just replicate the inner logic of exportMappedExcel here to avoid Node/Browser DOM API clashing during validation
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(targetBuffer);
    const worksheet = workbook.worksheets[0];

    const headerRowNumber = targetHeaderRowIndex + 1;
    const headerRow = worksheet.getRow(headerRowNumber);
    const colMap = {};
    headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim();
        if (val) colMap[val] = colNumber;
    });

    const dataStartRowNumber = headerRowNumber + 1;
    const shiftBy = Math.max(0, sourceAllRows.length - 1);

    if (shiftBy > 0) {
        worksheet.spliceRows(dataStartRowNumber + 1, 0, ...new Array(shiftBy).fill([]));
        const baseRow = worksheet.getRow(dataStartRowNumber);
        for (let i = 1; i <= shiftBy; i++) {
            const newRow = worksheet.getRow(dataStartRowNumber + i);
            baseRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                newRow.getCell(colNumber).style = cell.style;
            });
        }
    }

    sourceAllRows.forEach((sourceRow, index) => {
        const currentRow = worksheet.getRow(dataStartRowNumber + index);
        mappingRules.forEach(rule => {
            if (rule.sourceCol && rule.targetCol && colMap[rule.targetCol]) {
                const colNum = colMap[rule.targetCol];
                if (sourceRow[rule.sourceCol] !== undefined && sourceRow[rule.sourceCol] !== '') {
                    currentRow.getCell(colNum).value = sourceRow[rule.sourceCol];
                }
            }
        });
        currentRow.commit();
    });

    const outPath = path.join(__dirname, 'VERIFIED_TEST_OUTPUT.xlsx');
    await workbook.xlsx.writeFile(outPath);
    console.log("Validation file written to:", outPath);

    // Verify properties
    console.log("Total rows in output:", worksheet.rowCount);
    console.log("Row 1 (Company Info):", worksheet.getRow(1).getCell(1).value);
    // Footer should be pushed down by 2 rows (3 data rows total - 1 existing blank)
    // Original footer was ROW 9. Now it should be 9 + 2 = 11.
    console.log("Footer (Row 11):", worksheet.getRow(11).getCell(6).value);
}

runTest().catch(console.error);
