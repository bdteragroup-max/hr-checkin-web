/**
 * Formats a date or string into a 24-hour time string (HH:mm)
 * Uses th-TH locale with hour12: false to ensure consistency.
 */
export function formatTime24h(date: Date | string | null): string {
    if (!date) return "--:--";
    const d = typeof date === 'string' ? new Date(date) : date;
    
    return d.toLocaleTimeString("th-TH", {
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
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
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
 */
export function calcWorkingMinutes(startAt: Date, endAt: Date) {
    if (endAt <= startAt) return 0;

    let totalWorkingMinutes = 0;
    const current = new Date(startAt.getTime());

    while (current < endAt) {
        // Date part for current iteration
        const year = current.getFullYear();
        const month = (current.getMonth() + 1).toString().padStart(2, '0');
        const day = current.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Define Bangkok markers
        const dayStart = new Date(`${dateStr}T08:00:00+07:00`);
        const lunchStart = new Date(`${dateStr}T12:00:00+07:00`);
        const lunchEnd = new Date(`${dateStr}T13:00:00+07:00`);
        const dayOfWeek = current.getDay();

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

            totalWorkingMinutes += Math.max(0, mins);
        }

        // Move to start of next day (00:00:00) 
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
    }

    return totalWorkingMinutes;
}
