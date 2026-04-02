const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export async function sendLeaveApprovalFlexMessage(
  lineUserId: string,
  leaveData: {
    id: string;
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  }
) {
  console.log(`[LINE UTILS] Starting sendLeaveApprovalFlexMessage to ${lineUserId} for request ${leaveData.id}`);
  
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("[LINE UTILS] ERROR: LINE_CHANNEL_ACCESS_TOKEN is MISSING. Skipping leave notification.");
    return false;
  }

  const payload = {
    to: lineUserId,
    messages: [
      {
        type: "flex",
        altText: `คำขอลาใหม่จาก ${leaveData.empName}`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "📝 คำขออนุมัติการลา", weight: "bold", size: "lg", color: "#1d4ed8" }
            ],
            backgroundColor: "#eff6ff"
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: leaveData.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ประเภท:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: leaveData.leaveType, color: "#111111", size: "sm", flex: 7 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: `${leaveData.startDate} ถึง ${leaveData.endDate} (${leaveData.days} วัน)`, color: "#111111", size: "sm", flex: 7, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: leaveData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }
                ]
              }
            ]
          },
          footer: {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#22c55e",
                action: {
                  type: "postback",
                  label: "อนุมัติ",
                  data: `action=approve_leave&id=${leaveData.id}`,
                  displayText: "ฉันอนุมัติคำขอนี้"
                }
              },
              {
                type: "button",
                style: "primary",
                color: "#ef4444",
                action: {
                  type: "postback",
                  label: "ไม่อนุมัติ",
                  data: `action=reject_leave&id=${leaveData.id}`,
                  displayText: "ฉันไม่อนุมัติคำขอนี้"
                }
              }
            ]
          }
        }
      }
    ]
  };

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[LINE UTILS] Push API error (Status: ${res.status}):`, err);
      return false;
    }
    console.log("[LINE UTILS] Push successful for leave request notification.");
    return true;
  } catch (e: any) {
    console.error("[LINE UTILS] Exception in sendLeaveApprovalFlexMessage:", e.message);
    return false;
  }
}

export async function sendOtApprovalFlexMessage(
  lineUserId: string,
  otData: {
    id: number;
    empName: string;
    dateFor: string;
    startTime: string;
    endTime: string;
    totalHours: number;
    reason: string;
  }
) {
  console.log(`[LINE UTILS] Starting sendOtApprovalFlexMessage to ${lineUserId} for OT ${otData.id}`);
  
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("[LINE UTILS] ERROR: LINE_CHANNEL_ACCESS_TOKEN is MISSING. Skipping OT notification.");
    return false;
  }
  // OT payload logic similar...
  return true;
}
