-- Add new columns to employees
ALTER TABLE "employees" ADD COLUMN "nationality" VARCHAR(3) DEFAULT 'THA';
ALTER TABLE "employees" ADD COLUMN "id_document_type" VARCHAR(20) NOT NULL DEFAULT 'national_id';
ALTER TABLE "employees" ADD COLUMN "is_onboarding_complete" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing employees so they aren't silently dropped from payroll
UPDATE "employees" SET "is_onboarding_complete" = true WHERE "created_at" < now();

-- Create sso_configs table
CREATE TABLE "sso_configs" (
  "id" SERIAL NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "wage_ceiling" DECIMAL(10,2) NOT NULL,
  "min_wage" DECIMAL(10,2) NOT NULL DEFAULT 1650,
  "rate_employee" DECIMAL(5,2) NOT NULL,
  "rate_employer" DECIMAL(5,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sso_configs_pkey" PRIMARY KEY ("id")
);

-- Seed initial SSO configs (Gregorian Dates)
INSERT INTO "sso_configs" ("effective_from", "effective_to", "wage_ceiling", "min_wage", "rate_employee", "rate_employer") VALUES
('2026-01-01', '2028-12-31', 17500.00, 1650.00, 5.00, 5.00),
('2029-01-01', '2031-12-31', 20000.00, 1650.00, 5.00, 5.00),
('2032-01-01', NULL, 23000.00, 1650.00, 5.00, 5.00);
