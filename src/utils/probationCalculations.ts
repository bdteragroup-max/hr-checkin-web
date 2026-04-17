export const PROBATION_WEIGHTS = {
    work_quality: 4,
    work_quantity: 3,
    dedication: 8,
    knowledge: 5,
    learning: 5,
    obedience: 4,
    responsibility: 8,
    creativity: 6,
    teamwork: 3,
    discipline: 3,
    tool_maintenance: 3,
    participation: 5,
    late: 1,
    sick_leave: 1,
    personal_leave: 1
};

export function calculateAttendanceScore(type: "late" | "sick" | "personal", count: number): number {
    if (type === "late") {
        if (count === 0) return 5;
        if (count <= 2) return 4;
        if (count <= 5) return 3;
        if (count <= 10) return 2;
        return 1;
    }
    // Sick or Personal leave
    if (count === 0) return 5;
    if (count === 1) return 4;
    if (count === 2) return 3;
    if (count <= 4) return 2;
    return 1;
}

export function calculateGrade(totalScore: number): string {
    if (totalScore >= 280) return "A";
    if (totalScore >= 260) return "B";
    if (totalScore >= 240) return "C";
    if (totalScore >= 220) return "D";
    return "E";
}

export function calculateTotalScore(scores: Record<string, number>): number {
    let total = 0;
    for (const [key, weight] of Object.entries(PROBATION_WEIGHTS)) {
        const score = scores[key] || 0;
        total += score * weight;
    }
    return total;
}

/**
 * Calculates standardized 30-day evaluation windows relative to a hire date.
 * @param hireDateStr Employee hire date
 * @param evaluationNo Current evaluation (1, 2, or 3)
 */
export function calculateProbationDates(hireDateStr: string, evaluationNo: number) {
    if (!hireDateStr) return { start: "", end: "" };
    
    // Safely handle both "YYYY-MM-DD" and full ISO "YYYY-MM-DDTHH:mm:ss.sssZ"
    const dateBase = hireDateStr.split("T")[0];
    const hireDate = new Date(dateBase + "T12:00:00Z");
    
    // If date is invalid after parsing, return empty strings to prevent RangeError
    if (isNaN(hireDate.getTime())) {
        console.warn("[calculateProbationDates] Invalid hireDateStr:", hireDateStr);
        return { start: "", end: "" };
    }

    const startNum = evaluationNo - 1; 
    const endNum = evaluationNo;     
    
    const startDate = new Date(hireDate);
    // 30 days inclusive = Day X + 29 days offset
    startDate.setDate(hireDate.getDate() + (startNum * 29));
    
    const endDate = new Date(hireDate);
    endDate.setDate(hireDate.getDate() + (endNum * 29));
    
    return {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0]
    };
}

/**
 * Calculates a detailed age (Years, Months, Days) relative to a reference date.
 */
export function calculateAgeDetail(birthDateInput: Date | string | null, refDateInput: Date | string | null = new Date()): string {
    if (!birthDateInput) return "-";
    const birth = new Date(birthDateInput);
    const ref = new Date(refDateInput || new Date());

    if (isNaN(birth.getTime())) return "-";

    let years = ref.getFullYear() - birth.getFullYear();
    let months = ref.getMonth() - birth.getMonth();
    let days = ref.getDate() - birth.getDate();

    if (days < 0) {
        months -= 1;
        // Days in the month PRIOR to the reference month
        const prevMonth = new Date(ref.getFullYear(), ref.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days >= 0) parts.push(`${days} วัน`);

    return parts.length > 0 ? parts.join(" ") : "0 วัน";
}
