
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHANNEL_ACCESS_TOKEN = "o+EqUl3e7BreghRn83KGdpyU1xD0EJ6zo6WViyps7QJJzpqP3WcmcYCzXX2QriETGdGx2dwkXHGNhy+eOD3Sh3Cv2KH+xPIPNg3JOni4b7y1F5Ddq3zgtmwtvJRMmaBYYQH5gaonhAUnQVIwkLzN7QdB04t89/1O/w1cDnyilFU=";
const MANAGEMENT_ID = "U58336ad5442d461097e5d1abf3c75c17";

async function pushText(to, text) {
  if (!to || !CHANNEL_ACCESS_TOKEN) return;
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] })
  });
  return res.ok;
}

async function main() {
    const id = "TEST-LV-1775211731103";
    const updated = await prisma.leave_requests.update({
        where: { id },
        data: {
            status: 'approved',
            approved_by: 'System Test',
            approved_at: new Date()
        },
        include: { employees: true }
    });

    const summaryText = [
        "ข้อมูลการอนุมัติลา (สรุป - ทดสอบ)",
        `👤 พนักงาน: ${updated.name}`,
        `📝 ประเภท: ${updated.leave_type}`,
        `📅 วันที่: 3/4/2569 (0 วัน 4 ชม.)`,
        `💬 เหตุผล: ${updated.reason}`,
        `✅ หัวหน้างานที่อนุมัติ: SYSTEM`,
        `✅ HR ที่อนุมัติ: System Automated Test`
    ].join("\n");

    console.log("Sending to Management:", MANAGEMENT_ID);
    const sent = await pushText(MANAGEMENT_ID, summaryText);
    
    console.log(JSON.stringify({ 
        ok: true, 
        notifiedManagement: sent,
        id: updated.id,
        status: updated.status
    }));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
