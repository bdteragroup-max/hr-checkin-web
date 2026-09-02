import { prisma } from "./prisma";

/**
 * Returns the active SSO configuration for the given payroll period date.
 * The date should represent the payroll cycle being closed, not the current real-world date.
 * 
 * @param payrollPeriod - The date of the payroll period (e.g. 2028-12-31 for Dec 2028 payroll)
 * @returns The active SSO config for that period
 * @throws Error if no configuration covers the given date
 */
export async function getSsoConfig(payrollPeriod: Date) {
    const config = await prisma.sso_configs.findFirst({
        where: {
            effective_from: { lte: payrollPeriod },
            OR: [
                { effective_to: { gte: payrollPeriod } },
                { effective_to: null }
            ]
        },
        orderBy: { effective_from: "desc" }
    });

    if (!config) {
        throw new Error(`Social Security configuration not found for period ${payrollPeriod.toISOString().split('T')[0]}. Please check sso_configs table.`);
    }

    return config;
}

/**
 * Calculates the Social Security deduction for a given salary based on the SSO config.
 * 
 * @param salary - The employee's calculated salary for the month (Decimal or number)
 * @param config - The active SSO configuration
 * @returns The calculated deduction amount
 */
export function calculateSsoDeduction(salary: number, config: { min_wage_base: any, max_wage_base: any, employee_rate: any, rounding_mode?: string }) {
    const s = Number(salary);
    const minWage = Number(config.min_wage_base);
    const maxWage = Number(config.max_wage_base);
    const rate = Number(config.employee_rate) / 100; // stored as 5.00 -> 0.05

    // The base for SSO calculation is clamped between min_wage and wage_ceiling
    const base = Math.min(Math.max(s, minWage), maxWage);
    
    // Calculate deduction
    let deduction = base * rate;

    // Apply rounding rule
    if (config.rounding_mode === "floor") {
        deduction = Math.floor(deduction);
    } else if (config.rounding_mode === "ceil") {
        deduction = Math.ceil(deduction);
    } else {
        deduction = Math.round(deduction);
    }
    
    return deduction;

    // TODO: Confirm rounding rule from SSO. For now, rounding to nearest integer 
    // to mimic general Thai SSO e-Service defaults, but this may need adjustment to cents.
    return Math.round(deduction);
}
