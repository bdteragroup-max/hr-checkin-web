import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// Configuration
const CSV_FILE = path.join(__dirname, "leave_import_example.csv");
const DRY_RUN = process.env.DRY_RUN === "true" || true; // Default to true for safety

/**
 * Utility to calculate total working minutes (08:00-17:00, 1h lunch)
 * Simplified version of the app's internal logic for historical data
 */
function calculateMinutes(start: Date, end: Date): number {
    let totalMins = 0;
    const current = new Date(start.getTime());

    // Loop through each day from start to end (inclusive)
    while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        const dayStart = new Date(`${dateStr}T08:00:00+07:00`);
        const dayEnd = new Date(`${dateStr}T17:00:00+07:00`);
        const lunchStart = new Date(`${dateStr}T12:00:00+07:00`);
        const lunchEnd = new Date(`${dateStr}T13:00:00+07:00`);

        const overlapStart = start > dayStart ? (start > dayEnd ? dayEnd : start) : dayStart;
        const overlapEnd = end < dayEnd ? (end < dayStart ? dayStart : end) : dayEnd;

        // Intersection of [current's day boundaries] and [start, end]
        // But since we loop day by day, we just need to check the overlap of [dayStart, dayEnd] with [start, end]
        const actualStart = start > dayStart ? start : dayStart;
        const actualEnd = end < dayEnd ? end : dayEnd;

        if (actualStart < actualEnd) {
            let mins = Math.floor((actualEnd.getTime() - actualStart.getTime()) / 60000);
            
            // Lunch break overlap
            const overlapLunchStart = actualStart > lunchStart ? actualStart : lunchStart;
            const overlapLunchEnd = actualEnd < lunchEnd ? actualEnd : lunchEnd;
            if (overlapLunchStart < overlapLunchEnd) {
                mins -= Math.floor((overlapLunchEnd.getTime() - overlapLunchStart.getTime()) / 60000);
            }
            totalMins += Math.max(0, mins);
        }
        
        // Move to start of NEXT day
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        if (current > end) break;
    }
    return totalMins;
}

/**
 * Simple CSV Parser handles basic comma splitting
 */
function parseCsvLine(line: string) {
    const result = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === "," && !inQuote) {
            result.push(cur.trim());
            cur = "";
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result;
}

async function main() {
    console.log(`[IMPORT] Loading file: ${CSV_FILE}`);
    if (!fs.existsSync(CSV_FILE)) {
        console.error(`[ERROR] File not found: ${CSV_FILE}`);
        return;
    }

    const content = fs.readFileSync(CSV_FILE, "utf-8");
    const lines = content.split("\n").filter(l => l.trim().length > 0);
    const headers = parseCsvLine(lines[0]);

    console.log(`[IMPORT] Found ${lines.length - 1} records. Mode: ${DRY_RUN ? "DRY RUN (No changes)" : "LIVE IMPORT"}`);

    const leaveTypes = await prisma.leave_types.findMany();
    const typeMap = new Map(leaveTypes.map(t => [t.id, t.name]));

    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const record: any = {};
        headers.forEach((h, idx) => record[h] = values[idx]);

        const { emp_id, leave_type_id, start_at, end_at, reason, handover_person, status } = record;

        // Validation
        const emp = await prisma.employees.findUnique({ where: { emp_id } });
        if (!emp) {
            console.error(`[SKIP] Row ${i}: Employee ${emp_id} not found.`);
            continue;
        }

        if (!typeMap.has(leave_type_id)) {
            console.error(`[SKIP] Row ${i}: Leave type ${leave_type_id} not found.`);
            continue;
        }

        const startAt = new Date(start_at);
        const endAt = new Date(end_at);
        const minutes = calculateMinutes(startAt, endAt);
        const days = Math.ceil(minutes / 480); // Standard 8-hour work day = 480 mins

        const id = `LV-HIST-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

        console.log(`[PROCESS] Row ${i}: ${emp.name} (${emp_id}) -> ${leave_type_id} (${days} days, ${minutes} mins)`);

        if (!DRY_RUN) {
            await prisma.leave_requests.create({
                data: {
                    id,
                    emp_id,
                    name: emp.name,
                    leave_type_id,
                    leave_type: typeMap.get(leave_type_id)!,
                    start_at: startAt,
                    end_at: endAt,
                    start_date: new Date(startAt.toISOString().split("T")[0]),
                    end_date: new Date(endAt.toISOString().split("T")[0]),
                    minutes,
                    days,
                    reason: reason || "",
                    handover_person: handover_person === "NULL" ? null : handover_person,
                    status: status || "approved",
                    approved_at: new Date(),
                    approved_by: "HISTORICAL_IMPORT"
                }
            });
        }
    }

    console.log("\n[SUCCESS] Import complete.");
    if (DRY_RUN) console.log("[NOTE] This was a dry run. Set DRY_RUN=false env var to perform the actual import.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
