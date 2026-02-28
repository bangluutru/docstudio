import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Create Target Supplier Template (Empty rows, Japanese headers)
const supplierHeaders = ["品名", "数量", "単価", "納期", "備考"];
const supplierWs = XLSX.utils.aoa_to_sheet([supplierHeaders]);
const supplierWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(supplierWb, supplierWs, "Order Form");
XLSX.writeFile(supplierWb, path.join(__dirname, 'mock_supplier_template.xlsx'));

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
