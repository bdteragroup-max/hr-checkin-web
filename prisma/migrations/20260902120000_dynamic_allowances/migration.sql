BEGIN;

-- 1. Create allowance_types table
CREATE TABLE "allowance_types" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "default_sso_included" BOOLEAN NOT NULL DEFAULT false,
  "default_tax_included" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "allowance_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "allowance_types_company_id_name_key" ON "allowance_types"("company_id", "name");
ALTER TABLE "allowance_types" ADD CONSTRAINT "allowance_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Create employee_allowances table
CREATE TABLE "employee_allowances" (
  "id" SERIAL NOT NULL,
  "employee_id" VARCHAR(20) NOT NULL,
  "allowance_type_id" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "applies_to" VARCHAR(20) NOT NULL,
  "sso_included" BOOLEAN NOT NULL DEFAULT false,
  "tax_included" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_allowances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_allowances_employee_id_allowance_type_id_applies_to_key" ON "employee_allowances"("employee_id", "allowance_type_id", "applies_to");

ALTER TABLE "employee_allowances" ADD CONSTRAINT "employee_allowances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("emp_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_allowances" ADD CONSTRAINT "employee_allowances_allowance_type_id_fkey" FOREIGN KEY ("allowance_type_id") REFERENCES "allowance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Add allowance_mode to employees
ALTER TABLE "employees" ADD COLUMN "allowance_mode" VARCHAR(20) NOT NULL DEFAULT 'itemized';

-- 4. Execute the DO block for safe migration of data
DO $$
DECLARE
    old_sum DECIMAL;
    new_sum DECIMAL;
    default_company_id INTEGER;
BEGIN
    -- STEP A: Capture old sum
    SELECT COALESCE(SUM(fixed_accommodation_allowance), 0) +
           COALESCE(SUM(fixed_meal_allowance), 0) +
           COALESCE(SUM(fixed_travel_allowance), 0) +
           COALESCE(SUM(general_allowance), 0) +
           COALESCE(SUM(position_allowance), 0)
    INTO old_sum
    FROM "employees";

    -- Fetch the singleton company_settings id, use ORDER BY id ASC to be deterministic
    SELECT id INTO default_company_id FROM "company_settings" ORDER BY id ASC LIMIT 1;
    
    IF default_company_id IS NULL THEN
        RAISE EXCEPTION 'No company_settings found. Cannot seed allowance types or migrate data. Please set up company_settings first.';
    END IF;

    -- STEP B: Seed global allowance_types for the tenant
    INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included")
    VALUES (default_company_id, 'ค่าที่พัก/เช่าบ้าน', false, true) ON CONFLICT DO NOTHING;
    
    INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included")
    VALUES (default_company_id, 'ค่าอาหาร', false, true) ON CONFLICT DO NOTHING;
    
    INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included")
    VALUES (default_company_id, 'ค่าเดินทาง', false, true) ON CONFLICT DO NOTHING;
    
    INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included")
    VALUES (default_company_id, 'เงินช่วยเหลือเหมาจ่าย', false, true) ON CONFLICT DO NOTHING;
    
    INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included")
    VALUES (default_company_id, 'ค่าตำแหน่ง', true, true) ON CONFLICT DO NOTHING;

    -- STEP C: Migrate data (only where amount > 0)
    -- fixed_accommodation_allowance
    INSERT INTO "employee_allowances" ("employee_id", "allowance_type_id", "amount", "applies_to", "sso_included", "tax_included")
    SELECT e.emp_id, at.id, e.fixed_accommodation_allowance, 
           CASE WHEN e.probation_accommodation_allowance THEN 'always' ELSE 'after_probation' END,
           e.sso_include_fixed_accommodation, true
    FROM "employees" e
    JOIN "allowance_types" at ON at.name = 'ค่าที่พัก/เช่าบ้าน' AND at.company_id = default_company_id
    WHERE e.fixed_accommodation_allowance > 0;

    -- fixed_meal_allowance
    INSERT INTO "employee_allowances" ("employee_id", "allowance_type_id", "amount", "applies_to", "sso_included", "tax_included")
    SELECT e.emp_id, at.id, e.fixed_meal_allowance, 
           CASE WHEN e.probation_meal_allowance THEN 'always' ELSE 'after_probation' END,
           e.sso_include_fixed_meal, true
    FROM "employees" e
    JOIN "allowance_types" at ON at.name = 'ค่าอาหาร' AND at.company_id = default_company_id
    WHERE e.fixed_meal_allowance > 0;

    -- fixed_travel_allowance
    INSERT INTO "employee_allowances" ("employee_id", "allowance_type_id", "amount", "applies_to", "sso_included", "tax_included")
    SELECT e.emp_id, at.id, e.fixed_travel_allowance, 
           CASE WHEN e.probation_travel_allowance THEN 'always' ELSE 'after_probation' END,
           e.sso_include_fixed_travel, true
    FROM "employees" e
    JOIN "allowance_types" at ON at.name = 'ค่าเดินทาง' AND at.company_id = default_company_id
    WHERE e.fixed_travel_allowance > 0;

    -- general_allowance
    INSERT INTO "employee_allowances" ("employee_id", "allowance_type_id", "amount", "applies_to", "sso_included", "tax_included")
    SELECT e.emp_id, at.id, e.general_allowance, 
           'always',
           e.sso_include_general_allowance, true
    FROM "employees" e
    JOIN "allowance_types" at ON at.name = 'เงินช่วยเหลือเหมาจ่าย' AND at.company_id = default_company_id
    WHERE e.general_allowance > 0;

    -- position_allowance
    INSERT INTO "employee_allowances" ("employee_id", "allowance_type_id", "amount", "applies_to", "sso_included", "tax_included")
    SELECT e.emp_id, at.id, e.position_allowance, 
           'always',
           e.sso_include_position_allowance, true
    FROM "employees" e
    JOIN "allowance_types" at ON at.name = 'ค่าตำแหน่ง' AND at.company_id = default_company_id
    WHERE e.position_allowance > 0;

    -- STEP D: Verify sums
    SELECT COALESCE(SUM(amount), 0) INTO new_sum FROM "employee_allowances";

    IF old_sum != new_sum THEN
        RAISE EXCEPTION 'Migration failed! Old sum (%) does not match new sum (%). Rolling back.', old_sum, new_sum;
    END IF;

    RAISE NOTICE 'Migration successful. Total allowances moved: %', new_sum;
END $$;

-- 5. Drop old columns
ALTER TABLE "employees" DROP COLUMN "fixed_accommodation_allowance";
ALTER TABLE "employees" DROP COLUMN "fixed_meal_allowance";
ALTER TABLE "employees" DROP COLUMN "fixed_travel_allowance";
ALTER TABLE "employees" DROP COLUMN "probation_accommodation_allowance";
ALTER TABLE "employees" DROP COLUMN "probation_meal_allowance";
ALTER TABLE "employees" DROP COLUMN "probation_travel_allowance";
ALTER TABLE "employees" DROP COLUMN "sso_include_fixed_accommodation";
ALTER TABLE "employees" DROP COLUMN "sso_include_fixed_meal";
ALTER TABLE "employees" DROP COLUMN "sso_include_fixed_travel";
ALTER TABLE "employees" DROP COLUMN "general_allowance";
ALTER TABLE "employees" DROP COLUMN "sso_include_general_allowance";
ALTER TABLE "employees" DROP COLUMN "position_allowance";
ALTER TABLE "employees" DROP COLUMN "sso_include_position_allowance";

COMMIT;
