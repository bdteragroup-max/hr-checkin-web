const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding tax configs and company settings...");

    // Brackets JSON
    const brackets = JSON.stringify([
        { "min": 0, "max": 150000, "rate": 0 },
        { "min": 150001, "max": 300000, "rate": 0.05 },
        { "min": 300001, "max": 500000, "rate": 0.10 },
        { "min": 500001, "max": 750000, "rate": 0.15 },
        { "min": 750001, "max": 1000000, "rate": 0.20 },
        { "min": 1000001, "max": 2000000, "rate": 0.25 },
        { "min": 2000001, "max": 5000000, "rate": 0.30 },
        { "min": 5000001, "max": 999999999, "rate": 0.35 }
    ]);

    for (const year of [2024, 2025, 2026, 2027]) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO "tax_configs" (year, sso_rate, sso_max_monthly, sso_max_yearly, expense_deduct_rate, expense_deduct_max, personal_allowance, tax_brackets)
            VALUES (${year}, 5.0, 750.0, 9000.0, 50.0, 100000.0, 60000.0, '${brackets}')
            ON CONFLICT (year) DO NOTHING;
        `);
    }

    // Since there's no conflict key easily known for company_settings, just check if exists
    const existing = await prisma.$queryRawUnsafe(`SELECT * FROM "company_settings" LIMIT 1`);
    if (existing.length === 0) {
        await prisma.$executeRawUnsafe(`
            INSERT INTO "company_settings" (tax_id, name, address, branch_no)
            VALUES ('0105555123456', 'My Company Co., Ltd.', '123 Test Street, Bangkok 10000', '00000')
        `);
    }

    console.log("Done seeding.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
