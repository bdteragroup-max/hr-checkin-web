const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE checkins DROP CONSTRAINT IF EXISTS chk_checkins_late_status`);
        console.log("Dropped late status constraint.");
        await prisma.$executeRawUnsafe(`ALTER TABLE checkins DROP CONSTRAINT IF EXISTS chk_checkins_type`);
        console.log("Dropped type constraint.");
        
        await prisma.checkins.update({
            where: { id: 21n },
            data: { late_status: 'early', late_min: 208 }
        });
        console.log("Updated record 21 to early!");

    } catch (e) { console.error(e) }
}

main().finally(() => prisma.$disconnect());
