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
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not set. Skipping LINE notification.");
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
              {
                type: "text",
                text: "📝 คำขออนุมัติการลา",
                weight: "bold",
                size: "lg",
                color: "#1d4ed8"
              }
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
      console.error("LINE push message failed:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Failed to send LINE message:", e);
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
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN is not set. Skipping LINE notification.");
    return false;
  }

  const payload = {
    to: lineUserId,
    messages: [
      {
        type: "flex",
        altText: `คำขอทำงานล่วงเวลา (OT) จาก ${otData.empName}`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🕒 คำขอทำงานล่วงเวลา (OT)",
                weight: "bold",
                size: "lg",
                color: "#1d4ed8"
              }
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
                  { type: "text", text: otData.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: otData.dateFor, color: "#111111", size: "sm", flex: 7 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เวลา:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: `${otData.startTime} - ${otData.endTime} (${otData.totalHours} ชม.)`, color: "#111111", size: "sm", flex: 7, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 },
                  { type: "text", text: otData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }
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
                  data: `action=approve_ot&id=${otData.id}`,
                  displayText: "ฉันอนุมัติคำขอ OT นี้"
                }
              },
              {
                type: "button",
                style: "primary",
                color: "#ef4444",
                action: {
                  type: "postback",
                  label: "ไม่อนุมัติ",
                  data: `action=reject_ot&id=${otData.id}`,
                  displayText: "ฉันไม่อนุมัติคำขอ OT นี้"
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
      console.error("LINE push message failed:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Failed to send LINE message:", e);
    return false;
  }
}
