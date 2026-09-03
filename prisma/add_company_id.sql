BEGIN;

-- 1. Add company_id and sso_employer_no
ALTER TABLE "employees" ADD COLUMN "company_id" INT;
ALTER TABLE "company_settings" ADD COLUMN "sso_employer_no" VARCHAR(50);

-- 2. Backfill company_id using LIKE and prefix
UPDATE "employees" e
SET "company_id" = cs.id
FROM "company_settings" cs
WHERE (LEFT(e.emp_id, 2) = 'TG' AND cs.name LIKE '%กรุ%')
   OR (LEFT(e.emp_id, 2) = 'TE' AND cs.name LIKE '%อิเล็กทริค%')
   OR (LEFT(e.emp_id, 2) = 'TP' AND cs.name LIKE '%พาวเวอร์%');

-- 3. Validation: check for NULL company_id
DO $$
DECLARE
    missing_ids TEXT;
BEGIN
    SELECT string_agg(emp_id, ', ') INTO missing_ids FROM "employees" WHERE "company_id" IS NULL;
    IF missing_ids IS NOT NULL THEN
        RAISE EXCEPTION 'Found employees with an unidentified company: %', missing_ids;
    END IF;
END $$;

-- 4. Alter column to NOT NULL
ALTER TABLE "employees" ALTER COLUMN "company_id" SET NOT NULL;

-- 5. Add Foreign Key
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Update 67 employee_allowances
UPDATE "employee_allowances" ea
SET "allowance_type_id" = at_new.id
FROM "employees" e, "allowance_types" at_old, "allowance_types" at_new
WHERE ea.employee_id = e.emp_id
  AND ea.allowance_type_id = at_old.id
  AND at_new.name = at_old.name
  AND at_new.company_id = e.company_id;

COMMIT;
