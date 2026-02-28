const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const nullRows = await prisma.checkins.findMany({
        where: { late_status: null, type: "Check-in" }
    });
    
    let count = 0;
    for (const r of nullRows) {
        const d = new Date(r.timestamp);
        // BKK time: +7
        const bz = new Date(d.getTime() + 7 * 3600 * 1000);
        const h = bz.getUTCHours();
        const m = bz.getUTCMinutes();
        const totalMin = h * 60 + m;
        
        // Work start: 08:00
        const startMin = 8 * 60 + 0;
        const diffMin = totalMin - startMin;
        
        let status = "ontime";
        let min = 0;
        
        if (diffMin > 5) {
            status = "late";
            min = diffMin;
        } else if (diffMin > 0) {
            min = diffMin;
        }
        
        await prisma.checkins.update({
            where: { id: r.id },
            data: { late_status: status, late_min: min }
        });
        count++;
    }
    
    // Also patch Check-out rows
    const outRows = await prisma.checkins.findMany({
        where: { late_status: null, type: "Check-out" }
    });
    for (const r of outRows) {
        const d = new Date(r.timestamp);
        const bz = new Date(d.getTime() + 7 * 3600 * 1000);
        const h = bz.getUTCHours();
        const m = bz.getUTCMinutes();
        const totalMin = h * 60 + m;
        
        // Work end: 17:00
        const endMin = 17 * 60 + 0;
        const diffMin = totalMin - endMin;
        
        let status = "ontime";
        let min = 0;
        
        if (diffMin >= 30) {
            status = "ot";
            min = diffMin;
        }
        
        await prisma.checkins.update({
            where: { id: r.id },
            data: { late_status: status, late_min: min }
        });
        count++;
    }

    console.log("Patched " + count + " rows!");
    prisma.$disconnect();
}

main().catch(console.error);
