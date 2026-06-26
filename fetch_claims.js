const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const claims = await prisma.general_welfare_claims.findMany({
        where: { emp_id: 'TG63002' }
    });
    console.log(claims);
}
main().finally(() => prisma.$disconnect());
