import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function getAbsent() {
    try {
        const now = new Date();
        const str = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
        const localNow = new Date(str);
        const y = localNow.getFullYear();
        const m = String(localNow.getMonth() + 1).padStart(2, "0");
        const d = String(localNow.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}T00:00:00.000Z`;

        const todayStart = new Date(dateKey);
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

        console.log(`Report for: ${y}-${m}-${d}`);

        const activeEmployees = await prisma.employees.findMany({
            where: { is_active: true },
            select: {
                emp_id: true,
                name: true,
                branches: { select: { name: true } },
                departments: { select: { name: true } }
            },
            orderBy: [{ emp_id: 'asc' }]
        });

        const checkinsToday = await prisma.checkins.findMany({
            where: {
                date_key: todayStart,
                type: { in: ["Check-in", "Project-In"] }
            },
            select: { emp_id: true }
        });

        const checkedInSet = new Set(checkinsToday.map(c => c.emp_id));

        const leavesToday = await prisma.leave_requests.findMany({
            where: {
                status: "approved",
                start_date: { lte: todayEnd },
                end_date: { gte: todayStart }
            },
            select: { emp_id: true, leave_type: true }
        });

        const leaveMap = new Map();
        for (const l of leavesToday) {
            leaveMap.set(l.emp_id, l.leave_type);
        }

        const missing = activeEmployees
            .filter(emp => !checkedInSet.has(emp.emp_id))
            .map(emp => ({
                emp_id: emp.emp_id,
                name: emp.name,
                branch: emp.branches?.name || "N/A",
                dept: emp.departments?.name || "N/A",
                status: leaveMap.has(emp.emp_id) ? `On Leave (${leaveMap.get(emp.emp_id)})` : "Absent"
            }));

        console.log("Absenteeism Report:");
        console.table(missing);
        console.log(`Total Missing: ${missing.length}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getAbsent();
