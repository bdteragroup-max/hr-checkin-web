export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidayDates: Set<string>,
  hireDateStr?: string | null,
  resignationDateStr?: string | null,
) {
  let maxWorkdays = 0;
  
  const hireDate = hireDateStr ? new Date(hireDateStr) : null;
  if (hireDate) hireDate.setHours(0, 0, 0, 0);

  const resignationDate = resignationDateStr ? new Date(resignationDateStr) : null;
  if (resignationDate) resignationDate.setHours(0, 0, 0, 0);

  const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  let curr = new Date(startDate);
  while (curr <= endDate) {
      const dateStr = fmt(curr);
      const isHoliday = curr.getDay() === 0 || holidayDates.has(dateStr);
      const isResigned = resignationDate && curr > resignationDate;
      const isNotHiredYet = hireDate && curr < hireDate;

      if (isResigned) {
          curr.setDate(curr.getDate() + 1);
          continue;
      }

      if (!isNotHiredYet && !isHoliday) {
          maxWorkdays++;
      }
      
      curr.setDate(curr.getDate() + 1);
  }

  return maxWorkdays;
}

export function calculateEmployeeAllowances(
    emp: any,
    startDate: Date,
    endDate: Date,
    holidayDates: Set<string>,
    empCheckins: any[],
    empLeaves: any[],
    travelClaims: any[],
    empWarnings: any[],
    myAllowances: any[]
) {
    const fmt = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    let mealWorkdays = 0;
    let travelWorkdays = 0;
    let maxWorkdays = 0;
    let totalPaidDays = 0;
    let missingScanInCycle = false;

    const isOnTrial = emp.is_on_trial || false;
    const hasWarnings = empWarnings.length > 0;
    const hasLate = empCheckins.some(c => c.late_status === 'late' || c.score_late > 0);
    const hasLeave = empLeaves.length > 0;

    const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
    if (hireDate) hireDate.setHours(0, 0, 0, 0);

    let curr = new Date(startDate);
    while (curr <= endDate) {
        const dateStr = fmt(curr);
        const isHoliday = curr.getDay() === 0 || holidayDates.has(dateStr);
        const empResignationDate = emp.resignation_date ? new Date(emp.resignation_date) : null;
        const isResigned = empResignationDate && curr > empResignationDate;
        const isNotHiredYet = hireDate && curr < hireDate;

        if (isResigned) {
            curr.setDate(curr.getDate() + 1);
            continue;
        }

        if (!isNotHiredYet && !isHoliday) {
            maxWorkdays++;
        }

        const dayCheckins = empCheckins.filter(c => fmt(c.date_key) === dateStr);
        const hasIn = dayCheckins.some(c => ["Check-in", "Project-In", "Offsite-In", "Trip-Update"].includes(c.type));
        const hasOut = dayCheckins.some(c => ["Check-out", "Project-Out", "Offsite-Out"].includes(c.type));
        const hasValidAttendance = hasIn || hasOut;

        const isExempt = emp.is_checkin_exempt || false;
        const isOnLeave = empLeaves.some(l => dateStr >= fmt(l.start_date) && dateStr <= fmt(l.end_date));
        const empTravels = travelClaims.filter((t: any) => t.emp_id === emp.emp_id);
        const isOnTravel = empTravels.some((t: any) => dateStr >= fmt(t.date) && dateStr <= fmt(t.end_date || t.date));

        if (hasValidAttendance || (isExempt && !isHoliday) || isOnTravel) {
            totalPaidDays++;
        }

        if (!isOnLeave) {
            if (hasValidAttendance || isOnTravel) {
                if (!hasWarnings) {
                    if (!isOnTrial || emp.probation_meal_allowance) mealWorkdays++;
                    if (!isOnTrial || emp.probation_travel_allowance) travelWorkdays++;
                }
            } else if (isExempt) {
                if (!hasWarnings) {
                    if (!isOnTrial || emp.probation_meal_allowance) mealWorkdays++;
                    if (!isOnTrial || emp.probation_travel_allowance) travelWorkdays++;
                }
            } else if (!isHoliday && !hasValidAttendance && !isOnTravel) {
                missingScanInCycle = true;
            }
        }
        curr.setDate(curr.getDate() + 1);
    }

    let meal_allowance = 0;
    let travel_allowance = 0;
    
    let hasMealRow = false;
    let hasTravelRow = false;

    for (const a of myAllowances) {
        const isMeal = a.allowance_type?.name === 'ค่าอาหาร';
        const isTravel = a.allowance_type?.name === 'ค่าเดินทาง';
        
        if (isMeal) hasMealRow = true;
        if (isTravel) hasTravelRow = true;

        if (!isMeal && !isTravel) continue;
        
        if (a.void_on_warning && hasWarnings) continue;
        
        // Check applies_to logic
        if (a.applies_to === 'after_probation' && isOnTrial) {
            // Support legacy probation_meal_allowance logic alongside applies_to
            if (isMeal && !emp.probation_meal_allowance) continue;
            if (isTravel && !emp.probation_travel_allowance) continue;
        }

        let amount = 0;
        if (a.calc_basis === 'daily_attendance') {
            amount = Number(a.amount) * (isMeal ? mealWorkdays : travelWorkdays);
        } else {
            amount = Number(a.amount);
        }

        if (isMeal) meal_allowance += amount;
        if (isTravel) travel_allowance += amount;
    }

    // Apply Fallbacks if no explicit row
    if (!hasMealRow) {
        if (Number(emp.fixed_meal_allowance) > 0) {
            meal_allowance = Number(emp.fixed_meal_allowance);
        } else {
            if (!hasWarnings) {
                if (!isOnTrial || emp.probation_meal_allowance) {
                     meal_allowance = mealWorkdays * 100;
                }
            }
        }
    }

    if (!hasTravelRow) {
        if (Number(emp.fixed_travel_allowance) > 0) {
            travel_allowance = Number(emp.fixed_travel_allowance);
        } else {
            if (!hasWarnings) {
                if (!isOnTrial || emp.probation_travel_allowance) {
                     travel_allowance = travelWorkdays * 60;
                }
            }
        }
    }

    // max_meal_allowance and max_travel_allowance are typically equal to maxWorkdays * rate
    let max_meal_allowance = maxWorkdays * 100;
    if (Number(emp.fixed_meal_allowance) > 0) max_meal_allowance = Number(emp.fixed_meal_allowance);
    else if (hasMealRow) {
        const mRow = myAllowances.find(a => a.allowance_type?.name === 'ค่าอาหาร');
        if (mRow && mRow.calc_basis === 'fixed_monthly') max_meal_allowance = Number(mRow.amount);
        else if (mRow && mRow.calc_basis === 'daily_attendance') max_meal_allowance = maxWorkdays * Number(mRow.amount);
    }
    let meal_deduction = Math.max(0, max_meal_allowance - meal_allowance);

    let max_travel_allowance = maxWorkdays * 60;
    if (Number(emp.fixed_travel_allowance) > 0) max_travel_allowance = Number(emp.fixed_travel_allowance);
    else if (hasTravelRow) {
        const tRow = myAllowances.find(a => a.allowance_type?.name === 'ค่าเดินทาง');
        if (tRow && tRow.calc_basis === 'fixed_monthly') max_travel_allowance = Number(tRow.amount);
        else if (tRow && tRow.calc_basis === 'daily_attendance') max_travel_allowance = maxWorkdays * Number(tRow.amount);
    }
    let travel_deduction = Math.max(0, max_travel_allowance - travel_allowance);

    // If employee has Lump-sum Allowance (เงินช่วยเหลือเหมาจ่าย), they do not receive meal or travel allowance
    const hasLumpSum = (emp as any).allowance_mode === 'lump_sum' || myAllowances.some(a =>
        a.allowance_type?.name?.includes('เหมาจ่าย') ||
        a.allowance_type?.name?.toLowerCase().includes('lump')
    );

    if (hasLumpSum) {
        meal_allowance = 0;
        max_meal_allowance = 0;
        meal_deduction = 0;
        travel_allowance = 0;
        max_travel_allowance = 0;
        travel_deduction = 0;
    }

    return {
        meal_allowance, max_meal_allowance, meal_deduction,
        travel_allowance, max_travel_allowance, travel_deduction,
        maxWorkdays, mealWorkdays, travelWorkdays, totalPaidDays,
        missingScanInCycle, hasLate, hasLeave, hasWarnings
    };
}
