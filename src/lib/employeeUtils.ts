export function composeEmployeeName(
    title_prefix?: string | null,
    first_name?: string | null,
    last_name?: string | null
): string {
    const prefix = (title_prefix || '').trim();
    const first = (first_name || '').trim();
    const last = (last_name || '').trim();

    // If there's no first name (e.g. invalid input), just return whatever we can
    if (!first && !last) {
        return prefix;
    }

    // Special case for 'ว่าที่ร้อยตรี' which requires a space before the first name
    const spacing = prefix === 'ว่าที่ร้อยตรี' ? ' ' : '';
    
    return `${prefix}${spacing}${first} ${last}`.trim();
}
