const ExcelJS = require('exceljs');
const path = require('path');

async function checkFile() {
    const workbook = new ExcelJS.Workbook();
    // Use the Thai filename
    const filename = 'รายการสินค้าในคลัง.xlsx';
    try {
        await workbook.xlsx.readFile(filename);
        const worksheet = workbook.getWorksheet(1);
        console.log('Sheet Name:', worksheet.name);
        
        const rows = [];
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            if (rowNumber <= 5) {
                rows.push(row.values);
            }
        });
        console.log('Sample Data:', JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('Error reading file:', e);
    }
}

checkFile();
