const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

async function importData() {
    const workbook = new ExcelJS.Workbook();
    const filename = 'รายการสินค้าในคลัง.xlsx';
    try {
        await workbook.xlsx.readFile(filename);
        const worksheet = workbook.getWorksheet(1);
        
        console.log('Starting import...');
        let count = 0;
        
        // Skip header row
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const companyName = row.getCell(1).value?.toString() || '';
            const category = row.getCell(2).value?.toString() || '';
            const productCode = row.getCell(3).value?.toString() || '';
            const productName = row.getCell(4).value?.toString() || '';

            if (!productCode || !productName) continue;

            try {
                // Use raw SQL to bypass the missing model issue in generated client
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "products" (company_name, category, product_code, product_name, status, updated_at) 
                     VALUES ($1, $2, $3, $4, 'available', NOW())
                     ON CONFLICT (product_code) DO UPDATE SET 
                        company_name = EXCLUDED.company_name,
                        category = EXCLUDED.category,
                        product_name = EXCLUDED.product_name,
                        updated_at = NOW()`,
                    companyName, category, productCode, productName
                );
                count++;
                if (count % 10 === 0) console.log(`Imported ${count} items...`);
            } catch (err) {
                console.error(`Failed to import ${productCode}:`, err.message);
            }
        }
        
        console.log(`Import completed. Total items: ${count}`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

importData();
