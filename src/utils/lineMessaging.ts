const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

/**
 * Granular minute formatter: 480 mins = 1 day, 60 mins = 1 hour
 */
function formatLeaveMins(totalMins: number) {
  if (totalMins === 0) return "0 วัน";
  const days = Math.floor(totalMins / 480);
  const remainingMins = totalMins % 480;
  const hours = Math.floor(remainingMins / 60);
  const mins = remainingMins % 60;

  let res = "";
  if (days > 0) res += `${days} วัน `;
  if (hours > 0) res += `${hours} ชม. `;
  if (mins > 0) res += `${mins} นาที`;
  return res.trim() || "0 วัน";
}

/**
 * Generic helper to send LINE messages via Push or Reply
 */
async function sendLineMessage(to: string, messages: any[], replyToken?: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return false;
  if (!to?.trim() && !replyToken) return false;

  const url = replyToken
    ? "https://api.line.me/v2/bot/message/reply"
    : "https://api.line.me/v2/bot/message/push";

  const body: any = { messages };
  if (replyToken) body.replyToken = replyToken;
  else body.to = to;

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      if (res.ok) return true;
      const errTxt = await res.text();
      console.error("[LINE UTILS] sendLineMessage fail:", res.status, errTxt);
      return false; // If API responds with error, don't retry (app level error)
    } catch (e: any) {
      retries--;
      console.warn(`[LINE UTILS] Connection error (${e.message}), retries left: ${retries}`);
      if (retries === 0) {
        console.error("[LINE UTILS] sendLineMessage error after retries:", e);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s before retry
    }
  }
  return false;
}

export async function sendLeaveApprovalFlexMessage(
  lineUserId: string,
  leaveData: {
    id: string;
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
    handoverPerson?: string;
    quotaMins?: number;
    usedMins?: number;
    supervisorName?: string;
    approvedBy?: string;
  },
  isProcessed: boolean = false,
  replyToken?: string
) {
  const bodyContents: any[] = [
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
        { type: "text", text: `${leaveData.startDate} ถึง ${leaveData.endDate} (${formatLeaveMins(leaveData.minutes)})`, color: "#111111", size: "sm", flex: 7, wrap: true }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "รับผิดชอบแทน:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.handoverPerson || "-", color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }
      ]
    }
  ];

  if (leaveData.supervisorName) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "หัวหน้างาน:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.supervisorName, color: "#111111", size: "sm", flex: 7 }
      ]
    });
  }

  if (isProcessed && leaveData.approvedBy) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ผู้อนุมัติ:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: leaveData.approvedBy, color: "#16a34a", size: "sm", weight: "bold", flex: 7 }
      ]
    });
  }

  // 📝 OPTIONAL: Leave Balance Info
  if (leaveData.quotaMins !== undefined && leaveData.usedMins !== undefined) {
    const remainingMins = Math.max(0, leaveData.quotaMins - leaveData.usedMins);
    bodyContents.push(
      { type: "separator", margin: "lg" },
      { type: "text", text: "สรุปสิทธิ์การลา (ปีนี้)", weight: "bold", size: "xs", margin: "md", color: "#64748b" },
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        margin: "sm",
        contents: [
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "สิทธิ์ทั้งหมด:", size: "xs", color: "#888888", flex: 4 },
              { type: "text", text: formatLeaveMins(leaveData.quotaMins), size: "xs", color: "#111111", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ใช้ไปแล้ว (รวมครั้งนี้):", size: "xs", color: "#888888", flex: 4 },
              { type: "text", text: formatLeaveMins(leaveData.usedMins), size: "xs", color: "#111111", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "คงเหลือ:", size: "xs", color: "#888888", flex: 4 },
              { type: "text", text: formatLeaveMins(remainingMins), size: "xs", weight: "bold", color: "#16a34a", flex: 6 }
            ]
          }
        ]
      }
    );
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: isProcessed ? "ดำเนินการแล้ว" : "คำขออนุมัติการลา", weight: "bold", size: "lg", color: isProcessed ? "#64748b" : "#1d4ed8" }
      ],
      backgroundColor: isProcessed ? "#f1f5f9" : "#eff6ff"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: isProcessed ? [
        {
          type: "button",
          style: "secondary",
          color: "#9ca3af",
          height: "sm",
          action: {
            type: "postback",
            label: "ดำเนินการแล้ว",
            data: "none"
          }
        }
      ] : [
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
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: `คำขอลา: ${leaveData.empName}`, contents }], replyToken);
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
    hasDiscrepancy?: boolean;
    actualIn?: string;
    actualOut?: string;
    supervisorName?: string;
    approvedBy?: string;
  },
  isProcessed: boolean = false,
  replyToken?: string
) {
  const bodyContents: any[] = [
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
        { type: "text", text: "เวลาที่ขอ:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: `${otData.startTime} - ${otData.endTime} (${otData.totalHours} ชม.)`, color: "#111111", size: "sm", flex: 7, wrap: true }
      ]
    }
  ];

  if (otData.actualIn && otData.actualOut) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "บันทึกจริง:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: `${otData.actualIn} - ${otData.actualOut}`, color: "#475569", size: "sm", flex: 7 }
      ]
    });
  }

  bodyContents.push({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 },
      { type: "text", text: otData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }
    ]
  });

  if (otData.supervisorName) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "หัวหน้างาน:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: otData.supervisorName, color: "#111111", size: "sm", flex: 7 }
      ]
    });
  }

  if (isProcessed && otData.approvedBy) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ผู้อนุมัติ:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: otData.approvedBy, color: "#16a34a", size: "sm", weight: "bold", flex: 7 }
      ]
    });
  }

  if (otData.hasDiscrepancy) {
    bodyContents.unshift({
      type: "box",
      layout: "vertical",
      backgroundColor: "#fef2f2",
      cornerRadius: "md",
      paddingAll: "8px",
      contents: [
        {
          type: "text",
          text: "หมายเหตุ: พบความผิดปกติ: ชม. OT สูงกว่าเวลาปฏิบัติงานจริง",
          color: "#dc2626",
          size: "xs",
          weight: "bold",
          wrap: true
        }
      ],
      margin: "md"
    });
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: isProcessed ? "ดำเนินการแล้ว" : "คำขออนุมัติ OT", weight: "bold", size: "lg", color: isProcessed ? "#64748b" : "#6366f1" }
      ],
      backgroundColor: isProcessed ? "#f1f5f9" : "#eef2ff"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: isProcessed ? [
        {
          type: "button",
          style: "secondary",
          color: "#9ca3af",
          height: "sm",
          action: {
            type: "postback",
            label: "ดำเนินการแล้ว",
            data: "none"
          }
        }
      ] : [
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
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: `คำขอ OT: ${otData.empName}`, contents }], replyToken);
}

export async function sendHrLeaveNotification(
  leaveData: {
    id: string;
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
    handoverPerson?: string;
    supervisorName: string;
    quotaMins?: number;
    usedMins?: number;
  }
) {
  const hrLineUserId = process.env.HR_LINE_USER_ID;
  if (!hrLineUserId) return false;
  return sendLeaveApprovalFlexMessage(hrLineUserId, leaveData);
}

export async function sendHrOtNotification(
  otData: {
    id: number;
    empName: string;
    dateFor: string;
    startTime: string;
    endTime: string;
    totalHours: number;
    reason: string;
    supervisorName: string;
  }
) {
  const hrLineUserId = process.env.HR_LINE_USER_ID;
  if (!hrLineUserId) return false;
  return sendOtApprovalFlexMessage(hrLineUserId, otData);
}

export async function sendManagementLeaveApprovalMessage(
  leaveData: {
    id: string;
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
    handoverPerson?: string;
  }
) {
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;
  return sendLeaveApprovalFlexMessage(managementId, leaveData);
}

export async function sendEmployeeLeaveStatusNotification(
  lineUserId: string,
  leaveData: {
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
    handoverPerson?: string;
    status: "pending_supervisor" | "pending_hr" | "pending_management" | "approved" | "rejected";
    approvedBy?: string;
    rejectionReason?: string;
  }
) {
  const statusConfig = {
    pending_hr: { headerText: "รอ HR อนุมัติ", headerBg: "#fff7ed", headerColor: "#ea580c", badgeText: "รอ HR อนุมัติ", badgeColor: "#ea580c", altText: "ใบลาของคุณรอ HR อนุมัติ" },
    pending_management: { headerText: "รอฝ่ายบริหารอนุมัติ", headerBg: "#faf5ff", headerColor: "#7c3aed", badgeText: "รอฝ่ายบริหารอนุมัติ", badgeColor: "#7c3aed", altText: "ใบลาพักร้อนของคุณรอฝ่ายบริหารอนุมัติ" },
    approved: { headerText: "อนุมัติแล้ว", headerBg: "#f0fdf4", headerColor: "#16a34a", badgeText: "อนุมัติแล้ว", badgeColor: "#16a34a", altText: "ใบลาของคุณได้รับการอนุมัติแล้ว" },
    rejected: { headerText: "ไม่อนุมัติ", headerBg: "#fef2f2", headerColor: "#dc2626", badgeText: "ไม่อนุมัติ", badgeColor: "#dc2626", altText: "ใบลาของคุณไม่ได้รับการอนุมัติ" },
    pending_supervisor: { headerText: "ส่งคำขอแล้ว", headerBg: "#f0f9ff", headerColor: "#0284c7", badgeText: "รอหัวหน้าอนุมัติ", badgeColor: "#0284c7", altText: "ใบลาของคุณส่งถึงหัวหน้างานแล้ว" },
  };

  const cfg = statusConfig[leaveData.status];
  const bodyContents: any[] = [
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ประเภท:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.leaveType, color: "#111111", size: "sm", flex: 7 }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${leaveData.startDate} ถึง ${leaveData.endDate} (${formatLeaveMins(leaveData.minutes)})`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รับผิดชอบแทน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.handoverPerson || "-", color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] },
    { type: "separator", margin: "lg" },
    { type: "box", layout: "horizontal", margin: "lg", contents: [{ type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: cfg.badgeText, color: cfg.badgeColor, size: "sm", weight: "bold", flex: 7 }] }
  ];

  if (leaveData.approvedBy) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.approvedBy, color: "#111111", size: "sm", flex: 7 }] });
  if (leaveData.status === "rejected" && leaveData.rejectionReason) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.rejectionReason, color: "#dc2626", size: "sm", flex: 7, wrap: true }] });
  if (leaveData.status === "pending_hr") bodyContents.push({ type: "text", text: "หัวหน้าอนุมัติแล้ว กำลังรอ HR อนุมัติขั้นสุดท้าย", color: "#9ca3af", size: "xs", margin: "md", wrap: true });
  if (leaveData.status === "pending_management") bodyContents.push({ type: "text", text: "คำขอได้รับการส่งให้ฝ่ายบริหารอนุมัติแล้ว", color: "#9ca3af", size: "xs", margin: "md", wrap: true });

  const contents: any = {
    type: "bubble",
    header: { type: "box", layout: "vertical", contents: [{ type: "text", text: cfg.headerText, weight: "bold", size: "lg", color: cfg.headerColor }], backgroundColor: cfg.headerBg },
    body: { type: "box", layout: "vertical", spacing: "sm", contents: bodyContents }
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: cfg.altText, contents }]);
}

export async function sendEmployeeOtStatusNotification(
  lineUserId: string,
  otData: {
    empName: string;
    dateFor: string;
    startTime: string;
    endTime: string;
    totalHours: number;
    reason: string;
    status: "pending_supervisor" | "pending_hr" | "approved" | "rejected";
    approvedBy?: string;
    rejectionReason?: string;
  }
) {
  const statusConfig = {
    pending_hr: { headerText: "OT รอ HR อนุมัติ", headerBg: "#fff7ed", headerColor: "#ea580c", badgeText: "รอ HR อนุมัติ", badgeColor: "#ea580c" },
    approved: { headerText: "OT อนุมัติแล้ว", headerBg: "#f0fdf4", headerColor: "#16a34a", badgeText: "อนุมัติแล้ว", badgeColor: "#16a34a" },
    rejected: { headerText: "OT ไม่ได้รับการอนุมัติ", headerBg: "#fef2f2", headerColor: "#dc2626", badgeText: "ไม่อนุมัติ", badgeColor: "#dc2626" },
    pending_supervisor: { headerText: "ส่งคำขอ OT แล้ว", headerBg: "#f0f9ff", headerColor: "#0284c7", badgeText: "รอหัวหน้าอนุมัติ", badgeColor: "#0284c7" },
  };

  const cfg = statusConfig[otData.status];
  const bodyContents: any[] = [
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: otData.dateFor, color: "#111111", size: "sm", flex: 7 }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${otData.startTime} - ${otData.endTime} (${otData.totalHours} ชม.)`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: otData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "separator", margin: "lg" },
    { type: "box", layout: "horizontal", margin: "lg", contents: [{ type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: cfg.badgeText, color: cfg.badgeColor, size: "sm", weight: "bold", flex: 7 }] }
  ];

  if (otData.approvedBy) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: otData.approvedBy, color: "#111111", size: "sm", flex: 7 }] });

  const contents: any = {
    type: "bubble",
    header: { type: "box", layout: "vertical", contents: [{ type: "text", text: cfg.headerText, weight: "bold", size: "lg", color: cfg.headerColor }], backgroundColor: cfg.headerBg },
    body: { type: "box", layout: "vertical", spacing: "sm", contents: bodyContents }
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: `สถานะ OT: ${cfg.badgeText}`, contents }]);
}

export async function sendManagementLeaveSummary(data: {
  empName: string; leaveType: string; startDate: string; endDate: string; minutes: number; reason: string; handoverPerson?: string; supervisorName: string; hrName: string;
}) {
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;

  const timeStr = new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "ข้อมูลการอนุมัติลา (สรุป)", weight: "bold", size: "lg", color: "#1e293b" }
      ],
      backgroundColor: "#f8fafc"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ประเภท:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.leaveType, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.startDate} ถึง ${data.endDate} (${formatLeaveMins(data.minutes)})`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รับผิดชอบแทน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.handoverPerson || "-", color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] },
        { type: "separator", margin: "lg" },
        { type: "box", layout: "horizontal", margin: "lg", contents: [{ type: "text", text: "หัวหน้างาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.supervisorName, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ฝ่ายบุคคล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.hrName} (${timeStr})`, color: "#16a34a", size: "sm", weight: "bold", flex: 7 }] }
      ]
    }
  };

  return sendLineMessage(managementId, [{ type: "flex", altText: `สรุปการอนุมัติลา: ${data.empName}`, contents }]);
}

export async function sendManagementOtSummary(data: {
  empName: string; dateFor: string; startTime: string; endTime: string; totalHours: number; reason: string; supervisorName: string; hrName: string;
}) {
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;

  const timeStr = new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "ข้อมูลการอนุมัติ OT (สรุป)", weight: "bold", size: "lg", color: "#1e293b" }
      ],
      backgroundColor: "#f8fafc"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.dateFor, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.startTime} - ${data.endTime} (${data.totalHours} ชม.)`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
        { type: "separator", margin: "lg" },
        { type: "box", layout: "horizontal", margin: "lg", contents: [{ type: "text", text: "หัวหน้างาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.supervisorName, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ฝ่ายบุคคล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.hrName} (${timeStr})`, color: "#16a34a", size: "sm", weight: "bold", flex: 7 }] }
      ]
    }
  };

  return sendLineMessage(managementId, [{ type: "flex", altText: `สรุปการอนุมัติ OT: ${data.empName}`, contents }]);
}

/**
 * Sends a real-time Trip Update notification with Photo, Location, and Map Link
 */
export async function sendTripUpdateNotification(
  toIds: string[],
  data: {
    empName: string;
    locationName: string;
    timestamp: string;
    photoUrl: string;
    lat?: number;
    lon?: number;
    remark?: string;
  }
) {
  const mapUrl = data.lat && data.lon
    ? `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lon}`
    : null;

  const bodyContents: any[] = [
    {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "พนักงาน:", size: "sm", color: "#888888", flex: 3 },
            { type: "text", text: data.empName, size: "sm", weight: "bold", color: "#111111", flex: 7 }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "สถานที่:", size: "sm", color: "#888888", flex: 3 },
            { type: "text", text: data.locationName, size: "sm", color: "#111111", flex: 7, wrap: true }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "เวลา:", size: "sm", color: "#888888", flex: 3 },
            { type: "text", text: data.timestamp, size: "sm", color: "#111111", flex: 7 }
          ]
        }
      ]
    }
  ];

  if (data.remark) {
    bodyContents[0].contents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "หมายเหตุ:", size: "sm", color: "#888888", flex: 3 },
        { type: "text", text: data.remark, size: "sm", color: "#111111", flex: 7, wrap: true }
      ]
    });
  }

  const contents: any = {
    type: "bubble",
    hero: {
      type: "image",
      url: data.photoUrl || "https://placeholder.com/600x400",
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "Trip Update", weight: "bold", size: "xl", color: "#d93025" },
        ...bodyContents
      ]
    }
  };

  if (mapUrl) {
    contents.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#d93025",
          height: "sm",
          action: {
            type: "uri",
            label: "ดูบนแผนที่ (Google Maps)",
            uri: mapUrl
          }
        }
      ]
    };
  }

  // Send to all unique valid IDs
  const uniqueIds = Array.from(new Set(toIds.filter(id => !!id)));
  const results = await Promise.all(
    uniqueIds.map(id =>
      sendLineMessage(id, [{ type: "flex", altText: `Trip Update: ${data.empName}`, contents }])
    )
  );
  return results.length > 0 ? results.every(r => r) : true;
}

/**
 * Sends a real-time OT Verification notification when an employee checks out
 * Compares requested OT time vs actual checkout time
 */
export async function sendCheckoutOtVerificationNotification(
  data: {
    empName: string;
    dateFor: string;
    requestedTime: string;
    actualIn: string;
    actualOut: string;
    status: "ontime" | "early" | "late";
    diffMins: number;
    photoUrl: string;
  }
) {
  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  const targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  if (targetIds.length === 0) return false;

  const statusCfg = {
    ontime: { text: "✅ OT ครบถ้วน", color: "#16a34a" },
    early: { text: `⚠️ ออกก่อน (${data.diffMins} นาที)`, color: "#dc2626" },
    late: { text: "✅ ทำเกินเวลาที่ขอ", color: "#2563eb" }
  };
  const cfg = statusCfg[data.status];

  const contents: any = {
    type: "bubble",
    hero: {
      type: "image",
      url: data.photoUrl || "https://placeholder.com/600x400",
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "บันทึกการเลิกงาน (ตรวจสอบ OT)", weight: "bold", size: "lg", color: "#1e293b" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.dateFor, color: "#111111", size: "sm", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลาที่ขอ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.requestedTime, color: "#111111", size: "sm", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บันทึกจริง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.actualIn} - ${data.actualOut}`, color: "#111111", size: "sm", flex: 7 }] },
            { type: "separator", margin: "md" },
            { type: "box", layout: "horizontal", margin: "md", contents: [{ type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: cfg.text, color: cfg.color, size: "sm", weight: "bold", flex: 7 }] }
          ]
        }
      ]
    }
  };

  const results = await Promise.all(
    targetIds.map(id => sendLineMessage(id, [{ type: "flex", altText: `OT Check: ${data.empName}`, contents }]))
  );
  return results.every(r => r);
}

export async function sendAssetBorrowNotification(
  data: {
    empName: string;
    assetName: string;
    assetId: string;
    borrowDate: string;
    returnDate: string;
    location: string;
    jobTitle?: string;
    branchName?: string;
    photoUrl?: string;
  }
) {
  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  const targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  if (targetIds.length === 0) return false;

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "บันทึกการยืมอุปกรณ์", weight: "bold", size: "lg", color: "#1e293b" }
      ],
      backgroundColor: "#f1f5f9"
    },
    hero: data.photoUrl ? {
      type: "image",
      url: data.photoUrl,
      size: "full",
      aspectMode: "cover",
      aspectRatio: "16:9"
    } : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
            ...(data.jobTitle ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ตำแหน่ง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.jobTitle, color: "#64748b", size: "sm", flex: 7 }] }] : []),
            ...(data.branchName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "หน่วยงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.branchName, color: "#64748b", size: "sm", flex: 7 }] }] : []),
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "อุปกรณ์:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.assetName} (${data.assetId})`, color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่ยืม:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.borrowDate, color: "#111111", size: "sm", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "กำหนดคืน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.returnDate, color: "#2563eb", size: "sm", weight: "bold", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ชื่องาน / สถานที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.location, color: "#111111", size: "sm", flex: 7, wrap: true }] }
          ]
        }
      ]
    }
  };

  const results = await Promise.all(
    targetIds.map(id => sendLineMessage(id, [{ type: "flex", altText: `ยืมอุปกรณ์: ${data.assetName}`, contents }]))
  );
  return results.every(r => r);
}

/**
 * Sends a real-time Asset Returning notification
 */
export async function sendAssetReturnNotification(
  data: {
    empName: string;
    assetName: string;
    assetId: string;
    actualReturnDate: string;
    condition: string;
    isDamaged: boolean;
    jobTitle?: string;
    branchName?: string;
    photoUrl?: string;
    location?: string;
  }
) {
  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  const targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  if (targetIds.length === 0) return false;

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "บันทึกการคืนอุปกรณ์", weight: "bold", size: "lg", color: data.isDamaged ? "#dc2626" : "#16a34a" }
      ],
      backgroundColor: data.isDamaged ? "#fef2f2" : "#f0fdf4"
    },
    hero: data.photoUrl ? {
      type: "image",
      url: data.photoUrl,
      size: "full",
      aspectMode: "cover",
      aspectRatio: "16:9"
    } : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
            ...(data.jobTitle ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ตำแหน่ง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.jobTitle, color: "#64748b", size: "sm", flex: 7 }] }] : []),
            ...(data.branchName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "หน่วยงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.branchName, color: "#64748b", size: "sm", flex: 7 }] }] : []),
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "อุปกรณ์:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.assetName} (${data.assetId})`, color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่คืน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.actualReturnDate, color: "#111111", size: "sm", flex: 7 }] },
            ...(data.location ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ชื่องาน / สถานที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.location, color: "#111111", size: "sm", flex: 7, wrap: true }] }] : []),
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สภาพอุปกรณ์:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.condition, color: data.isDamaged ? "#dc2626" : "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] }
          ]
        }
      ]
    }
  };

  const results = await Promise.all(
    targetIds.map(id => sendLineMessage(id, [{ type: "flex", altText: `คืนอุปกรณ์: ${data.assetName}`, contents }]))
  );
  return results.every(r => r);
}
