/**
 * Formats an employee's display name by appending their nickname in parentheses.
 * Example: "สมชาย ใจดี" + "ชาย" → "สมชาย ใจดี (ชาย)"
 */
export function formatName(name: string, nickname: string | null | undefined): string {
    if (!nickname) return name;
    return `${name} (${nickname})`;
}
