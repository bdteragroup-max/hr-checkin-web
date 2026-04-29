const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sid = 'TG00001';
    const counts = {
        leave: await prisma.leave_requests.count({ where: { supervisor_id: sid, status: 'pending_supervisor' } }),
        ot: await prisma.ot_requests.count({ where: { supervisor_id: sid, status: 'pending_supervisor' } }),
        travel: await prisma.travel_claims.count({ where: { supervisor_id: sid, status: 'pending_supervisor' } }),
        commission: await prisma.commission_claims.count({ where: { supervisor_id: sid, status: 'pending_supervisor' } }),
        kpi: await prisma.kpi_evaluations.count({ where: { supervisor_id: sid, status: 'pending_supervisor' } })
    };
    console.log(JSON.stringify(counts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
