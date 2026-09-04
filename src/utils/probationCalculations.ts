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

/**
 * Safely parses a Date or YYYY-MM-DD string into a local Date at midnight,
 * preventing UTC timezone offset shifts (e.g. 17:00 UTC shifting back 1 calendar day).
 */
export function parseLocalDate(dateInput: Date | string | null | undefined): Date | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
        if (isNaN(dateInput.getTime())) return null;
        return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
    }
    const str = String(dateInput).split("T")[0].trim();
    const parts = str.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calculates Day 119 from a hire date.
 */
export function calculateD119(hireDateInput: Date | string): Date | null {
    const hire = parseLocalDate(hireDateInput);
    if (!hire) return null;
    const d119 = new Date(hire);
    d119.setDate(hire.getDate() + 119);
    return d119;
}

export interface ProbationNoticeDeadlineInfo {
    d119: Date;
    terminationDate: Date;
    noticeDeadline: Date;
    daysLeft: number;
    status: "normal" | "monitoring" | "urgent" | "due_today" | "overdue";
    statusEmoji: string;
    statusLabel: string;
    badgeStyle: {
        bg: string;
        color: string;
        border: string;
        iconBg: string;
    };
}

/**
 * Calculates legal termination date and notice deadline under Section 17 & 118 of the Thai Labor Protection Act.
 * Ensures the effective termination date does not exceed 119 days (no severance pay liability).
 * 
 * @param hireOrD119Input The employee's hire date or the pre-calculated D119 date
 * @param isAlreadyD119 Set to true if the input is already the D119 date
 * @param refDateInput Reference date to check remaining alert days (defaults to today)
 */
export function calculateProbationNoticeDeadline(
    hireOrD119Input: Date | string | null | undefined,
    isAlreadyD119: boolean = false,
    refDateInput: Date | string | null = new Date()
): ProbationNoticeDeadlineInfo | null {
    if (!hireOrD119Input) return null;

    const baseDate = parseLocalDate(hireOrD119Input);
    if (!baseDate) return null;

    const d119 = isAlreadyD119 ? baseDate : calculateD119(baseDate);
    if (!d119) return null;

    const y = d119.getFullYear();
    const m = d119.getMonth(); // 0-indexed

    // Last day of month where D119 is located
    const endCurrentMonth = new Date(y, m + 1, 0);

    let terminationDate: Date;
    if (d119.getDate() === endCurrentMonth.getDate()) {
        terminationDate = endCurrentMonth;
    } else {
        // End of previous month
        terminationDate = new Date(y, m, 0);
    }

    // Notice deadline = End of previous month relative to terminationDate (1 pay period prior)
    const noticeDeadline = new Date(terminationDate.getFullYear(), terminationDate.getMonth(), 0);

    const ref = parseLocalDate(refDateInput) || new Date();
    ref.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(noticeDeadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffMs = deadlineDate.getTime() - ref.getTime();
    const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let status: ProbationNoticeDeadlineInfo["status"] = "normal";
    let statusEmoji = "";
    let statusLabel = "";
    let badgeStyle = {
        bg: "#f0fdf4",
        color: "#15803d",
        border: "#bbf7d0",
        iconBg: "#dcfce7"
    };

    if (daysLeft < 0) {
        status = "overdue";
        statusEmoji = "";
        statusLabel = `เกินกำหนดแจ้งเตือนแล้ว (เลยกำหนด ${Math.abs(daysLeft)} วัน)`;
        badgeStyle = {
            bg: "#fef2f2",
            color: "#991b1b",
            border: "#fecaca",
            iconBg: "#fee2e2"
        };
    } else if (daysLeft === 0) {
        status = "due_today";
        statusEmoji = "";
        statusLabel = "วันนี้เป็นวันสุดท้ายที่ต้องแจ้งเตือน!";
        badgeStyle = {
            bg: "#fee2e2",
            color: "#dc2626",
            border: "#f87171",
            iconBg: "#fecaca"
        };
    } else if (daysLeft <= 3) {
        status = "urgent";
        statusEmoji = "";
        statusLabel = `ต้องแจ้งภายใน ${daysLeft} วัน (เร่งด่วน)`;
        badgeStyle = {
            bg: "#fff7ed",
            color: "#c2410c",
            border: "#fed7aa",
            iconBg: "#ffedd5"
        };
    } else if (daysLeft <= 7) {
        status = "monitoring";
        statusEmoji = "";
        statusLabel = `ต้องแจ้งภายใน ${daysLeft} วัน (เฝ้าระวัง)`;
        badgeStyle = {
            bg: "#fefce8",
            color: "#a16207",
            border: "#fef08a",
            iconBg: "#fef9c3"
        };
    } else {
        status = "normal";
        statusEmoji = "";
        statusLabel = `ยังไม่ถึงกำหนด (เหลืออีก ${daysLeft} วัน)`;
        badgeStyle = {
            bg: "#f0fdf4",
            color: "#15803d",
            border: "#bbf7d0",
            iconBg: "#dcfce7"
        };
    }

    return {
        d119,
        terminationDate,
        noticeDeadline,
        daysLeft,
        status,
        statusEmoji,
        statusLabel,
        badgeStyle
    };
}

export interface Round3NoticeGuidance {
    unlockDate75: Date;
    noticeDeadline: Date;
    terminationDate: Date;
    terminationMonth: string;
    isPastDeadline: boolean;
    guidanceMessage: string;
}

/**
 * Calculates opening date (Day 75 mark) and supervisor guidance for the 3rd evaluation cycle (90-day mark)
 * to ensure evaluation results are ready before the Section 17 legal notice deadline.
 */
export function getRound3NoticeGuidance(hireDateInput: Date | string | null | undefined): Round3NoticeGuidance | null {
    if (!hireDateInput) return null;
    const hire = parseLocalDate(hireDateInput);
    if (!hire) return null;

    const noticeInfo = calculateProbationNoticeDeadline(hire);
    if (!noticeInfo) return null;

    // Day 75: opens when reaching the 75-day mark (e.g. August 20, 2026 for June 4)
    const unlockDate75 = new Date(hire);
    unlockDate75.setDate(hire.getDate() + 75);

    const isPastDeadline = noticeInfo.daysLeft < 0;
    const terminationMonth = noticeInfo.terminationDate.toLocaleDateString("th-TH", { month: "long" });
    const deadlineFormatted = noticeInfo.noticeDeadline.toLocaleDateString("th-TH");

    let guidanceMessage = `กรุณาประเมินรอบที่ 3 ให้แล้วเสร็จภายในวันที่ ${deadlineFormatted} เพื่อให้ HR ออกหนังสือบอกกล่าวล่วงหน้าได้ทันสิ้นเดือน${terminationMonth}`;
    if (isPastDeadline) {
        guidanceMessage = `กำหนดแจ้งเตือนตามรอบปกติ (${deadlineFormatted}) ได้ล่วงเลยมาแล้ว หากประเมินไม่ผ่านและประสงค์ให้สิ้นสุดการจ้างภายใน 119 วัน (สิ้นเดือน${terminationMonth}) จะต้องดำเนินการจ่ายสินจ้างแทนการบอกกล่าวล่วงหน้า 1 เดือน`;
    }

    return {
        unlockDate75,
        noticeDeadline: noticeInfo.noticeDeadline,
        terminationDate: noticeInfo.terminationDate,
        terminationMonth,
        isPastDeadline,
        guidanceMessage
    };
}

