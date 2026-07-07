const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    // Manually push TP68012 as published with taxable income so the user can test the PDF immediately.
    await prisma.monthly_payroll_data.updateMany({
        where: { emp_id: 'TP68012', cycle_month: 7, cycle_year: 2026 },
        data: {
            is_published: true,
            taxable_income: 26320,
            provident_fund: 0,
            tax: 0,
            social_security: 875
        }
    });
    console.log("Updated TP68012 to published with taxable_income: 26320");
}

checkData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
