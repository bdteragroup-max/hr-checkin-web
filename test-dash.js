const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function jsonSafe(v) {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(jsonSafe);
    if (v && typeof v === "object") {
        const out = {};
        for (const [k, val] of Object.entries(v)) out[k] = jsonSafe(val);
        return out;
    }
    return v;
}

async function test() {
    const recentRows = await prisma.checkins.findMany({
        orderBy: { timestamp: "desc" },
        take: 2,
        select: {
            id: true,
            emp_id: true,
            name: true,
            type: true,
            timestamp: true,
            branch_name: true,
            distance: true,
            photo_url: true,
            late_status: true,
            late_min: true
        }
    });

    try {
       console.log("Safe:", JSON.stringify(jsonSafe(recentRows), null, 2));
    } catch(e) {
       console.error("jsonSafe CRASH!", e);
    }
    
    prisma.$disconnect();
}
test().catch(console.error);
