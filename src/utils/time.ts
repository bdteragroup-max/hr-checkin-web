/**
 * Returns the current instant in UTC.
 * Since Prisma/Postgres handles Timestamptz correctly, we should store pure UTC.
 */
export function getNowBangkok(): Date {
    return new Date();
}

/**
 * Returns a Date object representing the current "wall clock" time in Bangkok.
 * WARNING: The internal UTC representation of this Date object is shifted.
 * ONLY use this for fields that don't store timezones (like @db.Time) or for watermarks.
 */
export function getBangkokWallClock(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}

/**
 * Returns today's date in YYYY-MM-DD format for Bangkok.
 */
export function getTodayBangkokISO(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

/**
 * Formats a date into 24-hour time (HH:mm) for Bangkok.
 */
export function formatTime24h(date: Date | string | null): string {
    if (!date) return "--:--";
    const d = typeof date === 'string' ? new Date(date) : date;
    
    return d.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

/**
 * Formats a date into a full 24-hour time string with seconds (HH:mm:ss)
 */
export function formatTimeFull24h(date: Date | string | null): string {
    if (!date) return "--:--:--";
    const d = typeof date === 'string' ? new Date(date) : date;
    
    return d.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
}

/**
 * Formats a date into a Thai long date string
 */
export function formatDateThai(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === 'string' ? new Date(date) : date;
    
    return d.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

/**
 * Formats a date into a Thai short date string (DD MMM YYYY)
 */
export function formatDateShortThai(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === 'string' ? new Date(date) : date;
    
    return d.toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

/**
 * Generates an array of hours (00-23)
 */
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

/**
 * Generates an array of minutes (00-59)
 */
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
/**
 * Calculates net working minutes between two timestamps.
 * - Working Window: 08:00 - 17:00 (Standard 8-hour day)
 * - Lunch Break: 12:00 - 13:00 (Always excluded)
 * - Saturday Special: 08:00 - 15:00
 * - Sunday: Excluded
 * - Holidays: Excluded if provided
 */
export function calcWorkingMinutes(startAt: Date, endAt: Date, holidayDates: string[] = []) {
    if (endAt <= startAt) return 0;

    const holidaySet = new Set(holidayDates);
    let totalWorkingMinutes = 0;
    const current = new Date(startAt.getTime());

    while (current < endAt) {
        // Date part for current iteration
        const year = current.getFullYear();
        const month = (current.getMonth() + 1).toString().padStart(2, '0');
        const day = current.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dayOfWeek = current.getDay();

        // Check for Sunday or Holiday
        if (dayOfWeek === 0 || holidaySet.has(dateStr)) {
            // Move to next day and continue
            current.setDate(current.getDate() + 1);
            current.setHours(0, 0, 0, 0);
            continue;
        }

        // Define Bangkok markers
        const dayStart = new Date(`${dateStr}T08:00:00+07:00`);
        const lunchStart = new Date(`${dateStr}T12:00:00+07:00`);
        const lunchEnd = new Date(`${dateStr}T13:00:00+07:00`);

        // standard end 17:00, Saturday end 15:00
        const dayEnd = new Date(`${dateStr}T${dayOfWeek === 6 ? "15" : "17"}:00:00+07:00`);

        // Intersection of [current, endAt] and [dayStart, dayEnd]
        const actualStart = current > dayStart ? current : dayStart;
        const actualEnd = endAt < dayEnd ? endAt : dayEnd;

        if (actualStart < actualEnd) {
            let mins = Math.floor((actualEnd.getTime() - actualStart.getTime()) / 60000);

            // Subtract lunch break overlap if within working hours
            const overlapLunchStart = actualStart > lunchStart ? actualStart : lunchStart;
            const overlapLunchEnd = actualEnd < lunchEnd ? actualEnd : lunchEnd;

            if (overlapLunchStart < overlapLunchEnd) {
                const lunchOverlapMins = Math.floor((overlapLunchEnd.getTime() - overlapLunchStart.getTime()) / 60000);
                mins -= lunchOverlapMins;
            }

            // Saturday Policy: If it's a full Saturday shift (6 hours actual), count it as 8 hours (480 mins)
            if (dayOfWeek === 6 && mins >= 360) {
                mins = 480;
            }

            totalWorkingMinutes += Math.max(0, mins);
        }

        // Move to start of next day (00:00:00) 
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
    }

    return totalWorkingMinutes;
}
