const fs = require('fs');
const content = fs.readFileSync('src/utils/checkin.ts', 'utf8');
if (!content.includes('adjustCheckinsForLeaves')) {
    const newContent = content + `\n
export function adjustCheckinsForLeaves(checkinsAll: any[], leavesAll: any[]): any[] {
    const leavesByEmp = leavesAll.reduce((acc, curr) => {
        if (curr.status === 'approved') {
            acc[curr.emp_id] = acc[curr.emp_id] || [];
            acc[curr.emp_id].push(curr);
        }
        return acc;
    }, {} as Record<string, any[]>);

    return checkinsAll.map(c => {
        if (c.type !== 'Check-in' && c.type !== 'Project-In' && c.type !== 'Offsite-In') {
            return c;
        }

        const leaves = leavesByEmp[c.emp_id] || [];
        const checkinDate = new Date(c.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

        const matchingLeave = leaves.find(l => {
            const startD = new Date(l.start_date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
            const endD = new Date(l.end_date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
            return checkinDate >= startD && checkinDate <= endD;
        });

        if (matchingLeave) {
            let lateMin = c.late_min || 0;
            if (lateMin > 0) {
                if (matchingLeave.days === 0.5) {
                    const lType = matchingLeave.leave_type || '';
                    if (lType.includes('ครึ่งเช้า')) {
                        lateMin = Math.max(0, lateMin - 300);
                    }
                } else if (matchingLeave.days >= 1) {
                    lateMin = 0;
                }
            }

            const isLate = lateMin > 0;
            return {
                ...c,
                late_min: lateMin,
                late_status: isLate ? 'late' : (c.late_status === 'late' ? 'ontime' : c.late_status)
            };
        }

        return c;
    });
}
`;
    fs.writeFileSync('src/utils/checkin.ts', newContent);
    console.log('Appended adjustCheckinsForLeaves');
} else {
    console.log('Already exists');
}
