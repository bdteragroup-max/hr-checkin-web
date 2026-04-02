import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // try to get all projects if the table exists
    const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
    console.log("Available models:", models);
    if ((prisma as any).projects) {
        const projects = await (prisma as any).projects.findMany();
        const filtered = projects.filter((p: any) => 
            (p.latitude && p.latitude.toString().includes('13.6')) || 
            (p.longitude && p.longitude.toString().includes('101.11'))
        );
        console.log("Projects:", filtered);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
