import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const branches = await prisma.branches.findMany();
    const filtered = branches.filter((b: any) => 
        (b.center_lat && b.center_lat.toString().includes('13.6')) || 
        (b.center_lon && b.center_lon.toString().includes('101.1'))
    );
    console.log("Branches:", filtered);
}
main().catch(console.error).finally(() => prisma.$disconnect());
