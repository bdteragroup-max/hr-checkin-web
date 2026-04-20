
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function deepAudit() {
    console.log("--- Deep Audit Phase 2 ---");

    // 1. Check for legacy NULLs in critical leave fields
    const nullLeaves = await prisma.leave_requests.count({
        where: {
            OR: [ { start_at: null }, { end_at: null }, { minutes: null } ]
        }
    });
    if (nullLeaves > 0) {
        console.error(`[CRITICAL BUG] Found ${nullLeaves} leave requests with NULL start_at/end_at/minutes. Payroll will fail or ignore these.`);
    }

    // 2. Check for missing Line IDs for active employees (Blocks notifications)
    const missingLine = await prisma.employees.count({
        where: { is_active: true, line_user_id: null }
    });
    if (missingLine > 0) {
        console.warn(`[INFO] ${missingLine} active employees have not linked their LINE account. They won't receive notifications.`);
    }

    // 3. Check for OT requests with missing start_time/end_time
    const badOt = await prisma.ot_requests.count({
        where: {
            OR: [ { start_time: null }, { end_time: null } ]
        }
    });
    console.log(`OT records with bad times: ${badOt}`);

    // 4. Duplicate Check-ins (Multiple Check-ins of same type for one user per day)
    // (Excluding Project/Offsite since multiple might be valid if they move around)
    const duplicates = await prisma.$queryRaw`
        SELECT emp_id, date_key, type, COUNT(*) 
        FROM checkins 
        WHERE type IN ('Check-in', 'Check-out')
        GROUP BY emp_id, date_key, type
        HAVING COUNT(*) > 1
    `;
    if (duplicates.length > 0) {
        console.warn(`[WARN] Found ${duplicates.length} duplicate main check-ins (In/Out) per day. Might double count lates/overtime.`);
        console.log(JSON.stringify(duplicates, null, 2));
    }

    console.log("Deep Audit Phase 2 Completed.");
}

deepAudit().catch(console.error).finally(() => prisma.$disconnect());
