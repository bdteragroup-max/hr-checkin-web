const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

// We need two clients: one for local (source) and one for Supabase (target)
const localPrisma = new PrismaClient({
    datasources: { db: { url: process.env.LOCAL_DATABASE_URL } }
});

const remotePrisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

async function syncTable(tableName, findManyArgs = {}) {
    console.log(`Syncing table: ${tableName}...`);
    const data = await localPrisma[tableName].findMany(findManyArgs);
    console.log(`Found ${data.length} records in local ${tableName}.`);

    if (data.length === 0) return;

    let successCount = 0;
    for (const item of data) {
        try {
            await remotePrisma[tableName].upsert({
                where: { id: item.id, emp_id: item.emp_id }.id ? { id: item.id } : { emp_id: item.emp_id },
                update: item,
                create: item
            });
            successCount++;
        } catch (e) {
            console.error(`Failed to sync ${tableName} item:`, item.id || item.emp_id, e.message);
        }
    }
    console.log(`Successfully synced ${successCount}/${data.length} records to ${tableName}.`);
}

// Special handler for tables with unique identifiers other than 'id' or 'emp_id'
async function syncEmployees() {
    console.log(`Syncing table: employees (Pass 1: No supervisors)...`);
    const data = await localPrisma.employees.findMany();
    
    // Pass 1: Create employees without supervisor_id to avoid FK issues
    for (const item of data) {
        const { supervisor_id, ...empWithoutSupervisor } = item;
        await remotePrisma.employees.upsert({
            where: { emp_id: item.emp_id },
            update: empWithoutSupervisor,
            create: empWithoutSupervisor
        });
    }
    console.log(`Pass 1 completed. Syncing Pass 2 (Update supervisors)...`);

    // Pass 2: Update supervisor_id now that all employees exist
    for (const item of data) {
        if (item.supervisor_id) {
            await remotePrisma.employees.update({
                where: { emp_id: item.emp_id },
                data: { supervisor_id: item.supervisor_id }
            });
        }
    }
    console.log(`Synced ${data.length} employees with supervisors.`);
}

async function syncBranches() {
    console.log(`Syncing table: branches...`);
    const data = await localPrisma.branches.findMany();
    for (const item of data) {
        await remotePrisma.branches.upsert({
            where: { id: item.id },
            update: item,
            create: item
        });
    }
    console.log(`Synced ${data.length} branches.`);
}

async function syncDepartments() {
    console.log(`Syncing table: departments...`);
    const data = await localPrisma.departments.findMany();
    for (const item of data) {
        await remotePrisma.departments.upsert({
            where: { id: item.id },
            update: item,
            create: item
        });
    }
    console.log(`Synced ${data.length} departments.`);
}

async function syncJobPositions() {
    console.log(`Syncing table: job_positions...`);
    const data = await localPrisma.job_positions.findMany();
    for (const item of data) {
        await remotePrisma.job_positions.upsert({
            where: { id: item.id },
            update: item,
            create: item
        });
    }
    console.log(`Synced ${data.length} job_positions.`);
}

async function syncProjects() {
    console.log(`Syncing table: projects...`);
    const data = await localPrisma.projects.findMany();
    for (const item of data) {
        await remotePrisma.projects.upsert({
            where: { id: item.id },
            update: item,
            create: item
        });
    }
    console.log(`Synced ${data.length} projects.`);
}

async function main() {
    try {
        await syncBranches();
        await syncDepartments();
        await syncJobPositions();
        await syncProjects();
        await syncEmployees();
        console.log("Data sync completed!");
    } catch (error) {
        console.error("Sync error:", error);
    } finally {
        await localPrisma.$disconnect();
        await remotePrisma.$disconnect();
    }
}

main();
