import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const dateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    const dateKey = new Date(dateStr);
    
    // 🟢 2. Check for Public Holidays
    const holiday = await prisma.holidays.findUnique({
        where: { date: dateKey }
    });
    console.log("Holiday:", holiday);
}
main().catch(console.error).finally(() => prisma.$disconnect());
