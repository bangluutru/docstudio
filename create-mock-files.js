import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Create Target Supplier Template with complex layout (Company Info, Header, Blank Data Row, Footer)
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Purchase Order');

// Add company info
worksheet.addRow(["Huma Medical Production Co. Ltd", "", "", "PURCHASE ORDER"]);
worksheet.addRow(["Your Health, Our Care", "", "", "DATE: 2024-01-19"]);
worksheet.addRow([]); // empty spacing
worksheet.addRow(["BILL TO", "", "SHIP TO"]);
worksheet.addRow(["HSC JAPAN JOINT STOCK COMPANY", "", "HUMA MEDICAL HANOI"]);
worksheet.addRow([]); // empty spacing

// Add Table Headers (Row 7)
const headerRow = worksheet.addRow(["No.", "Item Code", "Item name/Package", "Pkg", "Unit Price", "Quantity", "TOTAL"]);
headerRow.font = { bold: true };
headerRow.eachCell(c => c.border = { top: { style: 'thin' }, bottom: { style: 'thin' } });

// Add Data Area (Row 8 - 1 empty sample row with formatting)
const dataRow = worksheet.addRow(["", "", "", "", "", "", ""]);
dataRow.eachCell(c => {
    c.border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
});

// Add Footer Area (Row 9-11)
worksheet.addRow(["", "", "", "", "", "SUBTOTAL", "0"]);
worksheet.addRow(["", "", "", "", "", "TAX", "0"]);
const totalRow = worksheet.addRow(["", "", "", "", "", "TOTAL", "0"]);
totalRow.font = { bold: true };

await workbook.xlsx.writeFile(path.join(__dirname, 'mock_supplier_template.xlsx'));

// 2. Create Source Customer Data (English headers, some data)
const customerData = [
    ["Product Name", "Qty", "Unit Price", "Delivery Date", "PO Number", "Remarks"],
    ["Okinawa Fucoidan EX", 100, 45.50, "2025-07-01", "PO-1001", "Urgent"],
    ["Natto Kinase Premium", 50, 22.00, "2025-07-15", "PO-1001", ""],
    ["Placenta Extract", 200, 15.75, "2025-07-01", "PO-1001", "Fragile packing"]
];
const customerWs = XLSX.utils.aoa_to_sheet(customerData);
const customerWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(customerWb, customerWs, "Sheet1");
XLSX.writeFile(customerWb, path.join(__dirname, 'mock_customer_order.xlsx'));

console.log("Mock Excel files created successfully.");
