const { PrismaClient } = require('../../../src/generated/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importCsv() {
    const csvPath = 'C:\\Users\\teragroup\\Desktop\\hr-checkin-web\\probation_evaluations_rows.csv';
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    
    const headers = lines[0].split(',');
    const records = [];
    let lastValidRecord = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV parse (considering commas inside quotes might exist but here they seem standard)
        // Since the Thai text has commas, splitting by comma is risky. 
        // I will use a more robust split or regex.
        const cols = line.split(',');

        const id = cols[0];
        const empId = cols[1];

        if (id && id.match(/^\d+$/)) {
            // New Record
            const record = {
                emp_id: empId,
                supervisor_id: cols[2] || "TE69001", // Fallback to TE69001 as discussed
                evaluation_no: parseInt(cols[3]) || 1,
                evaluation_date: new Date(), // Default to now if empty
                period_start: parseDate(cols[5]),
                period_end: parseDate(cols[6]),
                score_work_quality: parseInt(cols[7]) || 0,
                score_work_quantity: parseInt(cols[8]) || 0,
                score_dedication: parseInt(cols[9]) || 0,
                score_knowledge: parseInt(cols[10]) || 0,
                score_learning: parseInt(cols[11]) || 0,
                score_obedience: parseInt(cols[12]) || 0,
                score_responsibility: parseInt(cols[13]) || 0,
                score_creativity: parseInt(cols[14]) || 0,
                score_teamwork: parseInt(cols[15]) || 0,
                score_discipline: parseInt(cols[16]) || 0,
                score_tool_maintenance: parseInt(cols[17]) || 0,
                score_participation: parseInt(cols[18]) || 0,
                score_late: parseInt(cols[19]) || 0,
                score_sick_leave: parseInt(cols[20]) || 0,
                score_personal_leave: parseInt(cols[21]) || 0,
                count_late: parseInt(cols[22]) || 0,
                count_sick_leave: parseInt(cols[23]) || 0,
                count_personal_leave: parseInt(cols[24]) || 0,
                count_activity: parseInt(cols[25]) || 0,
                total_score: parseInt(cols[26]) || 0,
                grade: cols[27],
                comment_supervisor: cols[28] || "",
                comment_improvement: cols[29] || "",
                comment_praise: cols[30] || "",
                decision: cols[31] || "pass",
                salary_adjust_from: cols[32] ? parseFloat(cols[32]) : 0,
                salary_adjust_to: cols[33] ? parseFloat(cols[33]) : 0,
                status: "reviewed",
                hr_remark: "",
                is_sent_to_management: false
            };
            records.push(record);
            lastValidRecord = record;
        } else if (lastValidRecord) {
            // Malformed row with text -> Append to supervisor comment
            // Join all columns to capture the text
            const note = line.replace(/^,+|,+$/g, '').trim(); 
            if (note) {
                lastValidRecord.comment_supervisor += "\n" + note;
            }
        }
    }

    console.log(`Parsed ${records.length} records. Starting import...`);

    for (const data of records) {
        try {
            await prisma.probation_evaluations.create({ data });
            console.log(`Imported: ${data.emp_id} (No. ${data.evaluation_no})`);
        } catch (e) {
            console.error(`FAILED: ${data.emp_id}`, e.message);
        }
    }

    console.log("Import Complete.");
}

function parseDate(str) {
    if (!str || !str.includes('/')) return new Date();
    const [d, m, y] = str.split('/').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

importCsv();
