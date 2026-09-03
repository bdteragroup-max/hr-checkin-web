BEGIN;

-- 1. Travel expenses for 4 people (1560 -> 60)
UPDATE employee_allowances ea
SET amount = 60,
    calc_basis = 'daily_attendance',
    void_on_warning = true
FROM allowance_types at
WHERE ea.allowance_type_id = at.id
  AND at.name = 'ค่าเดินทาง';

-- 2. Meal expenses for 4 people (2600 -> 100)
UPDATE employee_allowances ea
SET amount = 100,
    calc_basis = 'daily_attendance',
    void_on_warning = true
FROM allowance_types at
WHERE ea.allowance_type_id = at.id
  AND at.name = 'ค่าอาหาร'
  AND ea.amount = 2600;

-- 3. Meal expenses TG66001 (1260 -> 1260, fixed_monthly)
UPDATE employee_allowances ea
SET calc_basis = 'fixed_monthly',
    void_on_warning = true
FROM allowance_types at
WHERE ea.allowance_type_id = at.id
  AND at.name = 'ค่าอาหาร'
  AND ea.employee_id = 'TG66001';

COMMIT;
