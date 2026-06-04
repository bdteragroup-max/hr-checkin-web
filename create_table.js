const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Creating employee_trainings table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "employee_trainings" (
        "id" SERIAL NOT NULL,
        "emp_id" VARCHAR(20) NOT NULL,
        "course_name" VARCHAR(255) NOT NULL,
        "institution_name" VARCHAR(255),
        "training_date_start" DATE,
        "training_date_end" DATE,
        "completion_percentage" DECIMAL(5,2),
        "effectiveness_result" TEXT,
        "certificate_file_url" TEXT,
        "assessor_id" VARCHAR(20),
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "employee_trainings_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "employee_trainings_emp_id_fkey" FOREIGN KEY ("emp_id") REFERENCES "employees"("emp_id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "employee_trainings_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "employees"("emp_id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    console.log("Table created successfully!");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
