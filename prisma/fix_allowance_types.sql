BEGIN;

-- 1. Create missing allowance_types for Company 3 (TE)
INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included", "is_active", "created_at", "updated_at")
SELECT 3, "name", "default_sso_included", "default_tax_included", "is_active", "created_at", "updated_at"
FROM "allowance_types"
WHERE "company_id" = 2;

-- 2. Create missing allowance_types for Company 4 (TP)
INSERT INTO "allowance_types" ("company_id", "name", "default_sso_included", "default_tax_included", "is_active", "created_at", "updated_at")
SELECT 4, "name", "default_sso_included", "default_tax_included", "is_active", "created_at", "updated_at"
FROM "allowance_types"
WHERE "company_id" = 2;

-- 3. Run the update on employee_allowances again
UPDATE "employee_allowances" ea
SET "allowance_type_id" = at_new.id
FROM "employees" e, "allowance_types" at_old, "allowance_types" at_new
WHERE ea.employee_id = e.emp_id
  AND ea.allowance_type_id = at_old.id
  AND at_new.name = at_old.name
  AND at_new.company_id = e.company_id;

COMMIT;
