
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkIntegrity() {
    console.log("--- System Data Integrity Check ---");

    // 1. Employee Check
    const emps = await prisma.employees.findMany({
        include: { departments: true, supervisor: true }
    });
    console.log(`Total Employees: ${emps.length}`);

    const missingDept = emps.filter(e => !e.department_id);
    if (missingDept.length > 0) {
        console.warn(`[WARN] ${missingDept.length} employees missing department:`, missingDept.map(e => e.name));
    }

    const missingSupervisor = emps.filter(e => !e.supervisor_id && e.is_active);
    if (missingSupervisor.length > 0) {
        console.warn(`[WARN] ${missingSupervisor.length} active employees missing supervisor (might bypass approval):`, missingSupervisor.map(e => e.name));
    }

    const missingSalaryType = emps.filter(e => !e.salary_type);
    if (missingSalaryType.length > 0) {
        console.warn(`[WARN] ${missingSalaryType.length} employees missing salary_type (defaults to monthly):`, missingSalaryType.map(e => e.name));
    }

    // 2. Leave Request Check
    const leaves = await prisma.leave_requests.findMany({
        where: { status: { not: "cancelled" } }
    });
    console.log(`Total Active/Pending Leaves: ${leaves.length}`);

    const mismatchedIds = [];
    const validEmpIds = new Set(emps.map(e => e.emp_id));
    for (const l of leaves) {
        if (!validEmpIds.has(l.emp_id)) {
            mismatchedIds.push(l.id);
        }
    }
    if (mismatchedIds.length > 0) {
        console.error(`[ERROR] ${mismatchedIds.length} leave requests point to non-existent emp_ids!`);
    }

    // 3. Check for interns having forbidden leave types (re-verification)
    const dailyInternIds = new Set(emps.filter(e => e.salary_type === 'daily').map(e => e.emp_id));
    const internForbidden = leaves.filter(l => dailyInternIds.has(l.emp_id) && !['sick', 'unpaid', 'business'].includes(l.leave_type_id));
    if (internForbidden.length > 0) {
        console.error(`[BUG] Interns have forbidden leave types:`, internForbidden.map(l => ({ id: l.id, type: l.leave_type_id })));
    }

    console.log("Check Completed.");
}

checkIntegrity().catch(console.error).finally(() => prisma.$disconnect());
