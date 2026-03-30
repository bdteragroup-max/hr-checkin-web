import jwt from "jsonwebtoken";

async function fetchReport() {
    // Generate token
    const token = jwt.sign(
        { emp_id: "admin", role: "admin" },
        "change_me_to_a_long_random_string",
        { expiresIn: "10m" }
    );

    const month = "2026-03";
    const url = `http://localhost:3000/api/admin/report?month=${month}&hide_resigned=1`;
    
    try {
        const res = await fetch(url, {
            headers: {
                Cookie: `admin_token=${token}`
            }
        });

        if (!res.ok) {
            console.error("Failed!", res.status, await res.text());
            return;
        }

        const data = await res.json();
        
        console.log("=== REPORT SUMMARY ===");
        console.log(`Work Days: ${data.workDays}`);
        console.log(`Total Employees: ${data.employees.length}`);
        console.log(`Late Times (Total): ${data.lateTimes}`);
        console.log(`OT Minutes (Total): ${data.otMinutes}`);
        console.log(`Leave Days (Total): ${data.leaveDays}`);
        console.log(`Absent Days (Total): ${data.absentDays}`);
        console.log(`Total OT Pay: ฿${data.totalOtPay}`);
        console.log(`Holidays: ${data.holidays}`);
        console.log("======================");
        console.log("");
        
        console.log("=== SAMPLE EMPLOYEES ===");
        data.employees.slice(0, 5).forEach((e: any) => {
            console.log(`- [${e.emp_id}] ${e.name} (Branch: ${e.branch}) | Present: ${e.presentDays} | Absent: ${e.absentDays} | Late: ${e.lateTimes} (${e.lateMins}m) | OT: ${e.otHours}h (฿${e.otPay})`);
        });
        
    } catch (err) {
        console.error("Error fetching report:", err);
    }
}

fetchReport();
