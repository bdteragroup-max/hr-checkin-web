const start1 = new Date("2026-04-06T08:00:00+07:00"); // Monday
const end1 = new Date("2026-04-06T17:00:00+07:00");

const start2 = new Date("2026-04-06T08:00:00+07:00");
const end2 = new Date("2026-04-06T13:00:00+07:00");

const start3 = new Date("2026-04-06T11:30:00+07:00");
const end3 = new Date("2026-04-06T13:30:00+07:00");

function calcMinutes(startAt, endAt) {
    if (endAt <= startAt) return 0;
    let totalWorkingMinutes = 0;
    let current = new Date(startAt.getTime());
    while (current < endAt) {
        const dateStr = current.getFullYear() + "-" + String(current.getMonth() + 1).padStart(2, '0') + "-" + String(current.getDate()).padStart(2, '0');
        const dayStart = new Date(`${dateStr}T08:00:00+07:00`);
        const lunchStart = new Date(`${dateStr}T12:00:00+07:00`);
        const lunchEnd = new Date(`${dateStr}T13:00:00+07:00`);
        const dayOfWeek = current.getDay();
        const dayEnd = new Date(`${dateStr}T${dayOfWeek === 6 ? "15" : "17"}:00:00+07:00`);

        const actualStart = current > dayStart ? current : dayStart;
        const actualEnd = endAt < dayEnd ? endAt : dayEnd;

        if (actualStart < actualEnd) {
            let mins = Math.floor((actualEnd.getTime() - actualStart.getTime()) / 60000);
            const overlapLunchStart = actualStart > lunchStart ? actualStart : lunchStart;
            const overlapLunchEnd = actualEnd < lunchEnd ? actualEnd : lunchEnd;
            if (overlapLunchStart < overlapLunchEnd) {
                const lunchOverlapMins = Math.floor((overlapLunchEnd.getTime() - overlapLunchStart.getTime()) / 60000);
                mins -= lunchOverlapMins;
            }
            totalWorkingMinutes += Math.max(0, mins);
        }
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
    }
    return totalWorkingMinutes;
}

console.log("08:00-17:00:", calcMinutes(start1, end1), "mins (Expected 480)");
console.log("08:00-13:00:", calcMinutes(start2, end2), "mins (Expected 240)");
console.log("11:30-13:30:", calcMinutes(start3, end3), "mins (Expected 60)");
