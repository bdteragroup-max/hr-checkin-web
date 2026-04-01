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
