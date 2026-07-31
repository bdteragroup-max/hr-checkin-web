import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const emp_id = 'TGIT015'; // Hired on 2026-06-02
    const startDate = new Date('2026-06-01T00:00:00Z');
    const endDate = new Date('2026-06-30T00:00:00Z');

    const emp = await prisma.employees.findUnique({ where: { emp_id } });
    if (!emp) return console.log("Not found");

    let checkins = await prisma.checkins.findMany({
        where: {
            emp_id,
            date_key: { gte: startDate, lte: endDate },
        },
        orderBy: { timestamp: "asc" },
    });

    const holidays = await prisma.holidays.findMany({
        where: { date: { gte: startDate, lte: endDate } }
    });
    const holidayMap = new Map<string, string>();
    holidays.forEach(h => {
        holidayMap.set(h.date.toISOString().split("T")[0], h.name);
    });

    const nowBKK = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const todayDate = new Date(Date.UTC(nowBKK.getFullYear(), nowBKK.getMonth(), nowBKK.getDate()));
    const effectiveEnd = endDate < todayDate ? endDate : todayDate;

    let preHireAbsences = 0;

    for (let dt = new Date(startDate); dt <= effectiveEnd; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const dateStr = dt.toISOString().split("T")[0];
        const isSunday = dt.getUTCDay() === 0;
        const holName = holidayMap.get(dateStr);

        let status = "ขาด";
        const empResignStr = emp.resignation_date ? emp.resignation_date.toISOString().split("T")[0] : null;

        if (empResignStr && dateStr > empResignStr) {
            status = "ลาออก";
        } else if (isSunday) {
            status = "วันหยุด";
        } else if (holName) {
            status = `หยุดพิเศษ (${holName})`;
        }
        
        // This simulates the checkin lookup (ignoring it for simplicity, since 2026-06-01 has no checkins)
        if (dateStr === '2026-06-01') {
            console.log(`Status for ${dateStr} is ${status}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
