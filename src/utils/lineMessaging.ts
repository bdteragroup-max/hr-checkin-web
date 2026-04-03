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

/**
 * Notify HR officer(s) that a leave request has been supervisor-approved
 * and is waiting for HR final approval.
 */
export async function sendHrLeaveNotification(
  leaveData: {
    id: string;
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    supervisorName: string;
  }
) {
  const hrLineUserId = process.env.HR_LINE_USER_ID;
  
  if (!hrLineUserId) {
    console.warn("[LINE UTILS] HR_LINE_USER_ID is not set. Skipping HR notification.");
    return false;
  }

  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("[LINE UTILS] ERROR: LINE_CHANNEL_ACCESS_TOKEN is MISSING. Skipping HR notification.");
    return false;
  }

  console.log(`[LINE UTILS] Sending HR leave notification to ${hrLineUserId.substring(0, 5)}... for ${leaveData.id}`);

  const lines = [
    "📋 คำขอลารอ HR อนุมัติ",
    "",
    `👤 พนักงาน: ${leaveData.empName}`,
    `📝 ประเภท: ${leaveData.leaveType}`,
    `📅 วันที่: ${leaveData.startDate} ถึง ${leaveData.endDate} (${leaveData.days} วัน)`,
    `💬 เหตุผล: ${leaveData.reason || "-"}`,
    `✅ หัวหน้าอนุมัติโดย: ${leaveData.supervisorName}`,
    "",
    "กรุณาตรวจสอบและอนุมัติในระบบ Admin",
  ];
  const text = lines.join("\n");

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: hrLineUserId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[LINE UTILS] HR push error (Status: ${res.status}):`, err);
      return false;
    }
    console.log("[LINE UTILS] HR notification sent successfully.");
    return true;
  } catch (e: any) {
    console.error("[LINE UTILS] Exception in sendHrLeaveNotification:", e.message);
    return false;
  }
}

/**
 * Send a rich Flex Message to the employee showing their leave status.
 * Supports 3 statuses: pending_hr, approved, rejected.
 * Uses the same card layout as the supervisor approval request.
 */
export async function sendEmployeeLeaveStatusNotification(
  lineUserId: string,
  leaveData: {
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    status: "pending_supervisor" | "pending_hr" | "approved" | "rejected";
    approvedBy?: string;
    rejectionReason?: string;
  }
) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("[LINE UTILS] ERROR: LINE_CHANNEL_ACCESS_TOKEN is MISSING. Skipping employee notification.");
    return false;
  }

  console.log(`[LINE UTILS] Sending leave status Flex to ${lineUserId.substring(0, 5)}... status=${leaveData.status}`);

  // Status configuration
  const statusConfig = {
    pending_hr: {
      headerText: "⏳ รอ HR อนุมัติ",
      headerBg: "#fff7ed",
      headerColor: "#ea580c",
      badgeText: "รอ HR อนุมัติ",
      badgeBg: "#fff7ed",
      badgeColor: "#ea580c",
      altText: "ใบลาของคุณรอ HR อนุมัติ",
    },
    approved: {
      headerText: "✅ อนุมัติแล้ว",
      headerBg: "#f0fdf4",
      headerColor: "#16a34a",
      badgeText: "อนุมัติแล้ว",
      badgeBg: "#dcfce7",
      badgeColor: "#16a34a",
      altText: "ใบลาของคุณได้รับการอนุมัติแล้ว",
    },
    rejected: {
      headerText: "❌ ไม่อนุมัติ",
      headerBg: "#fef2f2",
      headerColor: "#dc2626",
      badgeText: "ไม่อนุมัติ",
      badgeBg: "#fee2e2",
      badgeColor: "#dc2626",
      altText: "ใบลาของคุณไม่ได้รับการอนุมัติ",
    },
    pending_supervisor: {
      headerText: "⏳ ส่งคำขอแล้ว",
      headerBg: "#f0f9ff",
      headerColor: "#0284c7",
      badgeText: "รอหัวหน้าอนุมัติ",
      badgeBg: "#e0f2fe",
      badgeColor: "#0284c7",
      altText: "ใบลาของคุณส่งถึงหัวหน้างานแล้ว",
    },
  };

  const cfg = statusConfig[leaveData.status];

  // Build body contents
  const bodyContents: any[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ประเภท:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.leaveType, color: "#111111", size: "sm", flex: 7 },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: `${leaveData.startDate} ถึง ${leaveData.endDate} (${leaveData.days} วัน)`, color: "#111111", size: "sm", flex: 7, wrap: true },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true },
      ],
    },
    // Separator
    { type: "separator", margin: "lg" },
    // Status badge row
    {
      type: "box",
      layout: "horizontal",
      margin: "lg",
      contents: [
        { type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 },
        {
          type: "text",
          text: cfg.badgeText,
          color: cfg.badgeColor,
          size: "sm",
          weight: "bold",
          flex: 7,
        },
      ],
    },
  ];

  // Add "approved by" if available
  if (leaveData.approvedBy) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.approvedBy, color: "#111111", size: "sm", flex: 7 },
      ],
    });
  }

  // Add rejection reason if rejected
  if (leaveData.status === "rejected" && leaveData.rejectionReason) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.rejectionReason, color: "#dc2626", size: "sm", flex: 7, wrap: true },
      ],
    });
  }

  // Add pending_hr note
  if (leaveData.status === "pending_hr") {
    bodyContents.push({
      type: "text",
      text: "หัวหน้าอนุมัติแล้ว กำลังรอ HR อนุมัติขั้นสุดท้าย",
      color: "#9ca3af",
      size: "xs",
      margin: "md",
      wrap: true,
    });
  }

  const payload = {
    to: lineUserId,
    messages: [
      {
        type: "flex",
        altText: cfg.altText,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: cfg.headerText, weight: "bold", size: "lg", color: cfg.headerColor },
            ],
            backgroundColor: cfg.headerBg,
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: bodyContents,
          },
        },
      },
    ],
  };

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[LINE UTILS] Employee status Flex error (Status: ${res.status}):`, err);
      return false;
    }
    console.log("[LINE UTILS] Employee leave status Flex sent successfully.");
    return true;
  } catch (e: any) {
    console.error("[LINE UTILS] Exception in sendEmployeeLeaveStatusNotification:", e.message);
    return false;
  }
}
