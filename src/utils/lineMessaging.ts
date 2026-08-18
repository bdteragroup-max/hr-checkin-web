import { prisma } from "@/lib/prisma";

const nameCache = new Map<string, string>();
export async function formatNameDb(name: string | undefined): Promise<string> {
  if (!name || name.includes('(')) return name || "";
  if (nameCache.has(name)) return nameCache.get(name)!;
  try {
    const emp = await prisma.employees.findFirst({ where: { name }, select: { nickname: true } });
    if (emp && emp.nickname) {
      const res = name + ' (' + emp.nickname + ')';
      nameCache.set(name, res);
      return res;
    }
  } catch (e) { }
  nameCache.set(name, name);
  return name;
}

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
      let errObj = errTxt as any;
      try { errObj = JSON.parse(errTxt); } catch (e) { }
      console.error("[LINE UTILS] sendLineMessage fail:", res.status, JSON.stringify(errObj, null, 2));
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

/**
 * Helper to parse photoUrl which might be a single string or stringified JSON object of 5 photos
 */
function parsePhotoData(photoUrl: string | undefined): string[] {
  if (!photoUrl) return [];
  try {
    if (photoUrl.startsWith("{") || photoUrl.startsWith("[")) {
      const parsed = JSON.parse(photoUrl);
      if (typeof parsed === 'object' && parsed !== null) {
        // Handle object {front, back, left, right, mileage}
        return Object.values(parsed).filter(val => typeof val === 'string' && !!val) as string[];
      }
      if (Array.isArray(parsed)) return parsed.filter(v => !!v);
    }
  } catch (e) {
    // Falls back to single photo if not valid JSON
  }
  return [photoUrl];
}

/**
 * Helper to generate Flex Box components for multiple images
 */
function generateImageGrid(photoUrls: string[]) {
  if (photoUrls.length === 0) return null;
  if (photoUrls.length === 1) {
    return {
      type: "image",
      url: photoUrls[0],
      size: "full",
      aspectMode: "cover",
      aspectRatio: "16:9"
    };
  }

  // Create a grid layout (rows of images)
  const rows: any[] = [];
  for (let i = 0; i < photoUrls.length; i += 2) {
    const rowContents: any[] = [
      {
        type: "image",
        url: photoUrls[i],
        flex: 1,
        aspectRatio: "4:3",
        aspectMode: "cover"
      }
    ];
    if (photoUrls[i + 1]) {
      rowContents.push({
        type: "image",
        url: photoUrls[i + 1],
        flex: 1,
        aspectRatio: "4:3",
        aspectMode: "cover",
        margin: "sm"
      });
    } else {
      // Filler to keep balance if odd number of photos
      rowContents.push({ type: "filler", flex: 1 });
    }
    rows.push({
      type: "box",
      layout: "horizontal",
      contents: rowContents,
      margin: i > 0 ? "sm" : "none"
    });
  }

  return {
    type: "box",
    layout: "vertical",
    contents: rows
  };
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
  replyToken?: string,
  isModified: boolean = false
) {
  // Format names with nicknames
  if (leaveData) {
    if ((leaveData as any).empName) (leaveData as any).empName = await formatNameDb((leaveData as any).empName);
    if ((leaveData as any).supervisorName) (leaveData as any).supervisorName = await formatNameDb((leaveData as any).supervisorName);
    if ((leaveData as any).approvedBy) (leaveData as any).approvedBy = await formatNameDb((leaveData as any).approvedBy);
  }

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

  if ((leaveData as any).supervisorName) {
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
        {
          type: "text",
          text: isProcessed ? "ดำเนินการแล้ว" : (isModified ? "คำขอลา (แก้ไขข้อมูล)" : "คำขออนุมัติการลา"),
          weight: "bold",
          size: "lg",
          color: isProcessed ? "#64748b" : (isModified ? "#ca8a04" : "#1d4ed8")
        }
      ],
      backgroundColor: isProcessed ? "#f1f5f9" : (isModified ? "#fefce8" : "#eff6ff")
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
    isForgotClock?: boolean;
    forgotReason?: string;
  },
  isProcessed: boolean = false,
  replyToken?: string
) {
  // Format names with nicknames
  if (otData) {
    if ((otData as any).empName) (otData as any).empName = await formatNameDb((otData as any).empName);
    if ((otData as any).supervisorName) (otData as any).supervisorName = await formatNameDb((otData as any).supervisorName);
    if ((otData as any).approvedBy) (otData as any).approvedBy = await formatNameDb((otData as any).approvedBy);
  }

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

  if ((otData as any).supervisorName) {
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
  // Format names with nicknames
  if (leaveData) {
    if ((leaveData as any).empName) (leaveData as any).empName = await formatNameDb((leaveData as any).empName);
    if ((leaveData as any).supervisorName) (leaveData as any).supervisorName = await formatNameDb((leaveData as any).supervisorName);
    if ((leaveData as any).approvedBy) (leaveData as any).approvedBy = await formatNameDb((leaveData as any).approvedBy);
  }

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
  // Format names with nicknames
  if (otData) {
    if ((otData as any).empName) (otData as any).empName = await formatNameDb((otData as any).empName);
    if ((otData as any).supervisorName) (otData as any).supervisorName = await formatNameDb((otData as any).supervisorName);
    if ((otData as any).approvedBy) (otData as any).approvedBy = await formatNameDb((otData as any).approvedBy);
  }

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
  // Format names with nicknames
  if (leaveData) {
    if ((leaveData as any).empName) (leaveData as any).empName = await formatNameDb((leaveData as any).empName);
    if ((leaveData as any).supervisorName) (leaveData as any).supervisorName = await formatNameDb((leaveData as any).supervisorName);
    if ((leaveData as any).approvedBy) (leaveData as any).approvedBy = await formatNameDb((leaveData as any).approvedBy);
  }

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
    status: "pending_supervisor" | "pending_hr" | "pending_management" | "approved" | "rejected" | "cancelled";
    approvedBy?: string;
    rejectionReason?: string;
  }
) {
  // Format names with nicknames
  if (leaveData) {
    if ((leaveData as any).empName) (leaveData as any).empName = await formatNameDb((leaveData as any).empName);
    if ((leaveData as any).supervisorName) (leaveData as any).supervisorName = await formatNameDb((leaveData as any).supervisorName);
    if ((leaveData as any).approvedBy) (leaveData as any).approvedBy = await formatNameDb((leaveData as any).approvedBy);
  }

  const statusConfig = {
    pending_hr: { headerText: "รอ HR อนุมัติ", headerBg: "#fff7ed", headerColor: "#ea580c", badgeText: "รอ HR อนุมัติ", badgeColor: "#ea580c", altText: "ใบลาของคุณรอ HR อนุมัติ" },
    pending_management: { headerText: "รอฝ่ายบริหารอนุมัติ", headerBg: "#faf5ff", headerColor: "#7c3aed", badgeText: "รอฝ่ายบริหารอนุมัติ", badgeColor: "#7c3aed", altText: "ใบลาพักร้อนของคุณรอฝ่ายบริหารอนุมัติ" },
    approved: { headerText: "อนุมัติแล้ว", headerBg: "#f0fdf4", headerColor: "#16a34a", badgeText: "อนุมัติแล้ว", badgeColor: "#16a34a", altText: "ใบลาของคุณได้รับการอนุมัติแล้ว" },
    rejected: { headerText: "ไม่อนุมัติ", headerBg: "#fef2f2", headerColor: "#dc2626", badgeText: "ไม่อนุมัติ", badgeColor: "#dc2626", altText: "ใบลาของคุณไม่ได้รับการอนุมัติ" },
    pending_supervisor: { headerText: "ส่งคำขอแล้ว", headerBg: "#f0f9ff", headerColor: "#0284c7", badgeText: "รอหัวหน้าอนุมัติ", badgeColor: "#0284c7", altText: "ใบลาของคุณส่งถึงหัวหน้างานแล้ว" },
    cancelled: { headerText: "ยกเลิกแล้ว", headerBg: "#f3f4f6", headerColor: "#6b7280", badgeText: "ยกเลิกแล้ว", badgeColor: "#6b7280", altText: "ใบลาของคุณยกเลิกแล้ว" },
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

  if ((leaveData as any).approvedBy) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.approvedBy, color: "#111111", size: "sm", flex: 7 }] });
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

/**
 * Notifies Supervisor/HR about a cancelled leave request
 */
export async function sendLeaveCancelledNotification(
  lineUserId: string,
  leaveData: {
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
  }
) {
  // Format names with nicknames
  if (leaveData) {
    if ((leaveData as any).empName) (leaveData as any).empName = await formatNameDb((leaveData as any).empName);
    if ((leaveData as any).supervisorName) (leaveData as any).supervisorName = await formatNameDb((leaveData as any).supervisorName);
    if ((leaveData as any).approvedBy) (leaveData as any).approvedBy = await formatNameDb((leaveData as any).approvedBy);
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "ใบลาได้รับการยกเลิก", weight: "bold", size: "lg", color: "#64748b" }
      ],
      backgroundColor: "#f1f5f9"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ประเภท:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.leaveType, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${leaveData.startDate} ถึง ${leaveData.endDate} (${formatLeaveMins(leaveData.minutes)})`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
        { type: "separator", margin: "lg" },
        { type: "text", text: "สถานะ: ยกเลิกโดยพนักงาน", color: "#dc2626", size: "sm", weight: "bold", margin: "lg" }
      ]
    }
  };
  return sendLineMessage(lineUserId, [{ type: "flex", altText: `ยกเลิกใบลา: ${leaveData.empName}`, contents }]);
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
    isForgotClock?: boolean;
    forgotReason?: string;
  }
) {
  // Format names with nicknames
  if (otData) {
    if ((otData as any).empName) (otData as any).empName = await formatNameDb((otData as any).empName);
    if ((otData as any).supervisorName) (otData as any).supervisorName = await formatNameDb((otData as any).supervisorName);
    if ((otData as any).approvedBy) (otData as any).approvedBy = await formatNameDb((otData as any).approvedBy);
  }

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

  if ((otData as any).approvedBy) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: otData.approvedBy, color: "#111111", size: "sm", flex: 7 }] });

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
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

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
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

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
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

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
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

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
    extraTargetIds?: string[];
    inspectionSummary?: {
      status?: string;
      is_clean?: boolean;
      is_lights_ok?: boolean;
      is_tires_ok?: boolean;
      is_body_ok?: boolean;
      is_insurance_ok?: boolean;
      remark?: string;
    };
  }
) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  let targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  // Merge extra targets
  if (data.extraTargetIds && data.extraTargetIds.length > 0) {
    const uniqueExtras = data.extraTargetIds.filter(id => id && !targetIds.includes(id));
    targetIds = [...targetIds, ...uniqueExtras];
  }

  if (targetIds.length === 0) return false;

  const photos = parsePhotoData(data.photoUrl);
  const heroComponent = generateImageGrid(photos);

  const bodyContents: any[] = [
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
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สถานที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.location, color: "#111111", size: "sm", flex: 7, wrap: true }] }
      ]
    }
  ];

  // Add Inspection Summary if exists
  if (data.inspectionSummary) {
    const s = data.inspectionSummary;
    const checklistItems: any[] = [];

    const addItem = (label: string, value: string, isBad: boolean) => {
      checklistItems.push({
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: label, size: "xs", color: "#666666", flex: 6 },
          { type: "text", text: value, size: "xs", color: isBad ? "#dc2626" : "#16a34a", weight: "bold", flex: 4, align: "end" }
        ]
      });
    };

    if (s.status) addItem("สถานะรถ:", s.status, s.status.includes("ซ่อม"));
    if (s.is_clean !== undefined) addItem("ความสะอาด:", s.is_clean ? "สะอาด" : "ไม่สะอาด", !s.is_clean);
    if (s.is_lights_ok !== undefined) addItem("ระบบไฟ:", s.is_lights_ok ? "ปกติ" : "ไม่ปกติ", !s.is_lights_ok);
    if (s.is_tires_ok !== undefined) addItem("สภาพยาง:", s.is_tires_ok ? "ปกติ" : "ไม่ปกติ", !s.is_tires_ok);
    if (s.is_body_ok !== undefined) addItem("สภาพตัวถัง:", s.is_body_ok ? "ปกติ" : "ไม่ปกติ", !s.is_body_ok);
    if (s.is_insurance_ok !== undefined) addItem("ประกัน/พรบ.:", s.is_insurance_ok ? "ปกติ (>1ด.)" : "ใกล้หมด (<1ด.)", !s.is_insurance_ok);

    bodyContents.push(
      { type: "separator", margin: "lg" },
      { type: "text", text: "📋 การตรวจสอบสภาพรถ", weight: "bold", size: "sm", margin: "md", color: "#334155" },
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        margin: "sm",
        contents: checklistItems
      }
    );

    if (s.remark) {
      bodyContents.push({
        type: "text",
        text: `หมายเหตุ: ${s.remark}`,
        size: "xs",
        color: "#6b7280",
        margin: "md",
        wrap: true,
        style: "italic"
      });
    }
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "บันทึกการยืมรถยนต์ / อุปกรณ์", weight: "bold", size: "lg", color: "#1e293b" }
      ],
      backgroundColor: "#f1f5f9"
    },
    hero: heroComponent || undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: bodyContents
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
    extraTargetIds?: string[];
  }
) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  let targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  // Merge extra targets
  if (data.extraTargetIds && data.extraTargetIds.length > 0) {
    const uniqueExtras = data.extraTargetIds.filter(id => id && !targetIds.includes(id));
    targetIds = [...targetIds, ...uniqueExtras];
  }

  if (targetIds.length === 0) return false;

  const photos = parsePhotoData(data.photoUrl);
  const heroComponent = generateImageGrid(photos);

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "บันทึกการคืนรถยนต์ / อุปกรณ์", weight: "bold", size: "lg", color: data.isDamaged ? "#dc2626" : "#16a34a" }
      ],
      backgroundColor: data.isDamaged ? "#fef2f2" : "#f0fdf4"
    },
    hero: heroComponent || undefined,
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

/**
 * Sends a premium red-and-white 'greeting card' Payslip notification
 */
export async function sendPayslipNotification(lineUserId: string, data: {
  empName: string;
  month: number;
  year: number;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const monthName = THAI_MONTHS[data.month - 1] || `${data.month}`;
  const yearTh = data.year + 543;

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "PAYSLIP",
          weight: "bold",
          size: "xl",
          color: "#ffffff",
          align: "center"
        }
      ],
      backgroundColor: "#d93025"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "สลิปเงินเดือนออกแล้ว",
          weight: "bold",
          size: "lg",
          align: "center",
          color: "#d93025"
        },
        {
          type: "text",
          text: `ประจำเดือน ${monthName} ${yearTh}`,
          size: "sm",
          align: "center",
          color: "#64748b"
        },
        {
          type: "separator",
          margin: "xl"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "xl",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "คุณสามารถดาวน์โหลดสลิปเงินเดือนได้ที่:",
              size: "xs",
              color: "#94a3b8",
              align: "center"
            },
            {
              type: "text",
              text: "เมนู 'สลิปของฉัน' ในระบบเช็คอิน",
              size: "sm",
              weight: "bold",
              color: "#334155",
              align: "center",
              wrap: true
            }
          ]
        }
      ]
    }
  };

  return sendLineMessage(lineUserId, [
    {
      type: "flex",
      altText: `สลิปเงินเดือนประจำเดือน ${monthName} ออกแล้ว`,
      contents
    }
  ]);
}

/**
 * Sends a notification to HR when a supervisor submits a probation evaluation.
 */
export async function sendProbationEvaluationHrAlert(data: {
  empName: string;
  empId: string;
  supervisorName: string;
  evaluationNo: number;
  grade: string;
  totalScore: number;
  decision: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const hrLineUserId = process.env.HR_LINE_USER_ID;
  if (!hrLineUserId) return false;

  const decisionMap: Record<string, string> = {
    pass: "ผ่านทดลองงาน",
    fail: "ไม่ผ่านทดลองงาน",
    extend: "ต่อเวลาทดลองงาน",
    salary_adjust: "พิจารณาปรับเงินเดือน"
  };

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "แจ้งเตือนการประเมินงาน", weight: "bold", size: "lg", color: "#ffffff" }],
      backgroundColor: "#0369a1"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `หัวหน้างานประเมินผลพนักงานเรียบร้อยแล้ว`, size: "sm", color: "#6b7280" },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          backgroundColor: "#f8fafc",
          paddingAll: "12px",
          cornerRadius: "8px",
          contents: [
            { type: "text", text: `พนักงาน: ${data.empName}`, weight: "bold", size: "sm" },
            { type: "text", text: `รหัส: ${data.empId}`, size: "xs", color: "#64748b" },
            { type: "text", text: `ประเมินครั้งที่: ${data.evaluationNo}`, size: "xs", color: "#64748b" }
          ]
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "box", layout: "horizontal", contents: [
                { type: "text", text: "คะแนนที่ได้:", size: "sm", color: "#64748b", flex: 4 },
                { type: "text", text: `${data.totalScore} / 300`, size: "sm", weight: "bold", flex: 6 }
              ]
            },
            {
              type: "box", layout: "horizontal", contents: [
                { type: "text", text: "เกรด:", size: "sm", color: "#64748b", flex: 4 },
                { type: "text", text: data.grade, size: "sm", weight: "bold", color: "#d93025", flex: 6 }
              ]
            },
            {
              type: "box", layout: "horizontal", contents: [
                { type: "text", text: "สรุปผล:", size: "sm", color: "#64748b", flex: 4 },
                { type: "text", text: decisionMap[data.decision] || data.decision, size: "sm", weight: "bold", color: "#0369a1", flex: 6, wrap: true }
              ]
            }
          ]
        },
        { type: "separator", margin: "md" },
        { type: "text", text: `ผู้ประเมิน: ${data.supervisorName}`, size: "xs", color: "#94a3b8", align: "end" }
      ]
    }
  };

  return sendLineMessage(hrLineUserId, [{ type: "flex", altText: `ประเมินงาน: ${data.empName}`, contents }]);
}

/**
 * Sends a summary of the probation evaluation to Management.
 */
export async function sendProbationSummaryToManagement(data: {
  empName: string;
  totalScore: number;
  grade: string;
  decision: string;
  comment: string;
  hrName: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;

  const decisionMap: Record<string, string> = {
    pass: "✅ ผ่านการทดลองงาน",
    fail: "❌ ไม่ผ่านการทดลองงาน",
    extend: "⏳ ขยายระยะเวลาทดลองงาน",
    salary_adjust: "💰 พิจารณาปรับเงินเดือน"
  };

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "สรุปผลการประเมินงาน (ฝ่ายบริหาร)", weight: "bold", size: "md", color: "#1e293b" }],
      backgroundColor: "#f8fafc"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box", layout: "horizontal", contents: [
            { type: "text", text: "พนักงาน:", size: "sm", color: "#64748b", flex: 3 },
            { type: "text", text: data.empName, size: "sm", weight: "bold", flex: 7 }
          ]
        },
        {
          type: "box", layout: "horizontal", contents: [
            { type: "text", text: "คะแนน/เกรด:", size: "sm", color: "#64748b", flex: 3 },
            { type: "text", text: `${data.totalScore} แต้ม (${data.grade})`, size: "sm", weight: "bold", flex: 7 }
          ]
        },
        {
          type: "box", layout: "horizontal", contents: [
            { type: "text", text: "ผลประเมิน:", size: "sm", color: "#64748b", flex: 3 },
            { type: "text", text: decisionMap[data.decision] || data.decision, size: "sm", weight: "bold", color: "#16a34a", flex: 7, wrap: true }
          ]
        },
        { type: "separator", margin: "sm" },
        {
          type: "box", layout: "vertical", contents: [
            { type: "text", text: "ความเห็นสรุป:", size: "xs", color: "#64748b", margin: "xs" },
            { type: "text", text: data.comment || "-", size: "sm", color: "#334155", wrap: true, margin: "xs" }
          ]
        },
        { type: "text", text: `ฝ่ายบุคคล: ${data.hrName}`, size: "xxs", color: "#94a3b8", align: "end", margin: "md" }
      ]
    }
  };

  return sendLineMessage(managementId, [{ type: "flex", altText: `สรุปผลประเมิน: ${data.empName}`, contents }]);
}

/**
 * KPI Notification Helpers
 */

/**
 * 1. Notify Employee when Supervisor sets KPI
 */
export async function sendKpiDefineNotification(
  lineUserId: string,
  data: {
    evaluationNo: number;
    supervisorName: string;
  }
) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  if (!lineUserId) return false;
  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "แจ้งเตือนการกำหนด KPI", weight: "bold", size: "lg", color: "#ffffff" }],
      backgroundColor: "#d93025"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `หัวหน้างานได้กำหนดตัวชี้วัด KPI ของคุณแล้ว`, size: "sm", color: "#111111", wrap: true },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `ครั้งที่ประเมิน: ${data.evaluationNo}`, size: "sm", weight: "bold" },
            { type: "text", text: `ผู้กำหนด: ${data.supervisorName}`, size: "sm", color: "#64748b" }
          ]
        },
        { type: "separator", margin: "md" },
        { type: "text", text: "กรุณาเข้าระบบเพื่อดำเนินการ 'ประเมินตนเอง' ในขั้นตอนต่อไป", size: "xs", color: "#d93025", weight: "bold", wrap: true }
      ]
    }
  };
  return sendLineMessage(lineUserId, [{ type: "flex", altText: "แจ้งเตือนการกำหนด KPI", contents }]);
}

/**
 * 2. Notify Supervisor when Employee self-rates
 */
export async function sendKpiSelfRateNotification(
  lineUserId: string,
  data: {
    empName: string;
    evaluationNo: number;
  }
) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  if (!lineUserId) return false;
  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "แจ้งเตือนการประเมินตนเองเสร็จสิ้น", weight: "bold", size: "lg", color: "#ffffff" }],
      backgroundColor: "#fa6400"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `พนักงานใต้บังคับบัญชาของคุณดำเนินการประเมินตนเองเสร็จแล้ว`, size: "sm", color: "#111111", wrap: true },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `พนักงาน: ${data.empName}`, size: "sm", weight: "bold" },
            { type: "text", text: `ครั้งที่ประเมิน: ${data.evaluationNo}`, size: "sm", color: "#64748b" }
          ]
        },
        { type: "separator", margin: "md" },
        { type: "text", text: "กรุณาเข้าระบบเพื่อดำเนินการ 'ประเมินผล' ขั้นสุดท้าย", size: "xs", color: "#fa6400", weight: "bold", wrap: true }
      ]
    }
  };
  return sendLineMessage(lineUserId, [{ type: "flex", altText: `แจ้งเตือนการประเมินตนเอง: ${data.empName}`, contents }]);
}

/**
 * 3. Notify HR when Supervisor evaluates
 */
export async function sendKpiEvaluateHrAlert(data: {
  empName: string;
  supervisorName: string;
  evaluationNo: number;
  totalScore: number;
  grade: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const hrLineUserId = process.env.HR_LINE_USER_ID;
  if (!hrLineUserId) return false;

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "แจ้งเตือนผลการประเมิน KPI (ส่งถึง HR)", weight: "bold", size: "lg", color: "#ffffff" }],
      backgroundColor: "#0369a1"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `หัวหน้างานได้ส่งผลการประเมิน KPI มายังฝ่ายบุคคลแล้ว`, size: "sm", color: "#111111", wrap: true },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `พนักงาน: ${data.empName}`, size: "sm", weight: "bold" },
            { type: "text", text: `ผู้ประเมิน: ${data.supervisorName}`, size: "sm", color: "#64748b" },
            { type: "text", text: `ประเมินครั้งที่: ${data.evaluationNo}`, size: "sm", color: "#64748b" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "คะแนนเฉลี่ย:", size: "sm", color: "#64748b", flex: 4 },
            { type: "text", text: `${data.totalScore.toFixed(2)}`, size: "sm", weight: "bold", flex: 6 }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "เกรดที่ได้:", size: "sm", color: "#64748b", flex: 4 },
            { type: "text", text: data.grade, size: "sm", weight: "bold", color: "#d93025", flex: 6 }
          ]
        }
      ]
    }
  };

  return sendLineMessage(hrLineUserId, [{ type: "flex", altText: `ผลการประเมิน KPI: ${data.empName}`, contents }]);
}

/**
 * 4. Notify Management with Summary
 */
export async function sendKpiManagementSummary(data: {
  empName: string;
  supervisorName: string;
  totalScore: number;
  grade: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "สรุปผลการประเมิน KPI (ฝ่ายบริหาร)", weight: "bold", size: "md", color: "#1e293b" }],
      backgroundColor: "#f8fafc"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box", layout: "horizontal", contents: [
            { type: "text", text: "พนักงาน:", size: "sm", color: "#64748b", flex: 3 },
            { type: "text", text: data.empName, size: "sm", weight: "bold", flex: 7 }
          ]
        },
        {
          type: "box", layout: "horizontal", contents: [
            { type: "text", text: "คะแนนเฉลี่ย:", size: "sm", color: "#64748b", flex: 3 },
            { type: "text", text: `${data.totalScore.toFixed(2)}`, size: "sm", weight: "bold", flex: 7 }
          ]
        },
        {
          type: "box", layout: "horizontal", contents: [
            { type: "text", text: "เกรดสรุป:", size: "sm", color: "#64748b", flex: 3 },
            { type: "text", text: data.grade, size: "sm", weight: "bold", color: "#d93025", flex: 7 }
          ]
        },
        { type: "separator", margin: "sm" },
        { type: "text", text: `ผู้รับผิดชอบการประเมิน: ${data.supervisorName}`, size: "xxs", color: "#94a3b8", align: "end", margin: "md" }
      ]
    }
  };

  return sendLineMessage(managementId, [{ type: "flex", altText: `สรุป KPI: ${data.empName}`, contents }]);
}

/**
 * 4. Notify Employee when Supervisor evaluates KPI
 */
export async function sendKpiEvaluateEmployeeNotification(
  lineUserId: string,
  data: {
    evaluationNo: number;
    totalScore: number;
    grade: string;
    supervisorName: string;
  }
) {
  // Format names with nicknames
  if (data && data.supervisorName) {
    data.supervisorName = await formatNameDb(data.supervisorName);
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: "ผลการประเมิน KPI ของคุณ", weight: "bold", size: "lg", color: "#ffffff" }],
      backgroundColor: "#16a34a"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `หัวหน้างานได้ทำการประเมิน KPI ของคุณเสร็จสิ้นแล้ว`, size: "sm", color: "#111111", wrap: true },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `ผู้ประเมิน: ${data.supervisorName}`, size: "sm", color: "#64748b" },
            { type: "text", text: `รอบการประเมินครั้งที่: ${data.evaluationNo}`, size: "sm", color: "#64748b" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: "คะแนนเฉลี่ย:", size: "sm", color: "#64748b", flex: 4 },
            { type: "text", text: `${data.totalScore.toFixed(2)}`, size: "sm", weight: "bold", flex: 6 }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "เกรดที่คุณได้รับ:", size: "sm", color: "#64748b", flex: 4 },
            { type: "text", text: data.grade, size: "sm", weight: "bold", color: "#16a34a", flex: 6 }
          ]
        },
        { type: "text", text: "คุณสามารถดูรายละเอียดคะแนนและข้อเสนอแนะเพิ่มเติมได้ในระบบ", size: "xs", color: "#9ca3af", margin: "lg", wrap: true }
      ]
    }
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: "แจ้งเตือนผลการประเมิน KPI", contents }]);
}

/**
 * 5. Notify Meeting Room Booking
 */
export async function sendMeetingBookingNotification(
  data: {
    roomName: string;
    floor: number;
    startTime: string;
    endTime: string;
    purpose: string;
    bookerName: string;
    meetingLink?: string | null;
    attendees: string[]; // Names
  },
  targetLineIds: string[]
) {
  // Format names with nicknames
  if (data) {
    if (data.bookerName) data.bookerName = await formatNameDb(data.bookerName);
    if (data.attendees && data.attendees.length > 0) {
      data.attendees = await Promise.all(data.attendees.map(async (name) => await formatNameDb(name)));
    }
  }

  const hrId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;

  // Combine all recipients, removing duplicates and nulls
  const allTargets = Array.from(new Set([...targetLineIds, hrId, managementId].filter(id => !!id)));

  const bodyContents: any[] = [
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ห้องประชุม:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.roomName} (ชั้น ${data.floor})`, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.startTime} - ${data.endTime}`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "หัวข้อ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.purpose || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้จอง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.bookerName, color: "#111111", size: "sm", flex: 7 }] },
  ];

  if (data.attendees.length > 0) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      contents: [
        { type: "text", text: "ผู้เข้าร่วม:", color: "#888888", size: "sm" },
        {
          type: "text",
          text: data.attendees.map((name, i) => `${i + 1}. ${name}`).join("\n"),
          color: "#111111",
          size: "sm",
          wrap: true,
          margin: "xs"
        }
      ]
    });
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "แจ้งเตือนการจองห้องประชุม", weight: "bold", size: "lg", color: "#ffffff" }
      ],
      backgroundColor: "#0ea5e9"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents
    }
  };

  if (data.meetingLink) {
    contents.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#0ea5e9",
          action: {
            type: "uri",
            label: "เข้าร่วมการประชุม",
            uri: data.meetingLink.startsWith("http") ? data.meetingLink : `https://${data.meetingLink}`
          }
        }
      ]
    };
  }

  // Send to all targets
  const results = await Promise.all(
    allTargets.map(id => sendLineMessage(id!, [{ type: "flex", altText: `จองห้องประชุม: ${data.purpose}`, contents }]))
  );

  return results.every(r => r);
}

export async function sendMeetingBookingCancelledNotification(
  data: {
    roomName: string;
    floor: number;
    startTime: string;
    endTime: string;
    purpose: string;
    bookerName: string;
    attendees: string[];
    cancellerName?: string;
  },
  targetLineIds: string[]
) {
  if (data) {
    if (data.bookerName) data.bookerName = await formatNameDb(data.bookerName);
    if (data.cancellerName) data.cancellerName = await formatNameDb(data.cancellerName);
    if (data.attendees && data.attendees.length > 0) {
      data.attendees = await Promise.all(data.attendees.map(async (name) => await formatNameDb(name)));
    }
  }

  const hrId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  const allTargets = Array.from(new Set([...targetLineIds, hrId, managementId].filter(id => !!id)));

  const bodyContents: any[] = [
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ห้องประชุม:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.roomName} (ชั้น ${data.floor})`, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.startTime} - ${data.endTime}`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "หัวข้อ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.purpose || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้จอง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.bookerName, color: "#111111", size: "sm", flex: 7 }] },
  ];

  if (data.cancellerName) {
    bodyContents.push(
      { type: "separator", margin: "md" },
      { type: "box", layout: "horizontal", margin: "md", contents: [{ type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `ยกเลิกโดย ${data.cancellerName}`, color: "#dc2626", size: "sm", weight: "bold", flex: 7 }] }
    );
  } else {
    bodyContents.push(
      { type: "separator", margin: "md" },
      { type: "text", text: "สถานะ: ยกเลิกการจองแล้ว", color: "#dc2626", size: "sm", weight: "bold", margin: "md", align: "center" }
    );
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "ยกเลิกการจองห้องประชุม", weight: "bold", size: "lg", color: "#ffffff" }
      ],
      backgroundColor: "#64748b"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents
    }
  };

  const results = await Promise.all(
    allTargets.map(id => sendLineMessage(id!, [{ type: "flex", altText: `ยกเลิกจองห้องประชุม: ${data.purpose}`, contents }]))
  );

  return results.every(r => r);
}

export async function sendMeetingBookingUpdatedNotification(
  data: {
    roomName: string;
    floor: number;
    startTime: string;
    endTime: string;
    purpose: string;
    bookerName: string;
    attendees: string[];
    updatedByName?: string;
  },
  targetLineIds: string[]
) {
  if (data) {
    if (data.bookerName) data.bookerName = await formatNameDb(data.bookerName);
    if (data.updatedByName) data.updatedByName = await formatNameDb(data.updatedByName);
    if (data.attendees && data.attendees.length > 0) {
      data.attendees = await Promise.all(data.attendees.map(async (name) => await formatNameDb(name)));
    }
  }

  const hrId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  const allTargets = Array.from(new Set([...targetLineIds, hrId, managementId].filter(id => !!id)));

  const bodyContents: any[] = [
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ห้องประชุม:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.roomName} (ชั้น ${data.floor})`, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.startTime} - ${data.endTime}`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "หัวข้อ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.purpose || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้จอง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.bookerName, color: "#111111", size: "sm", flex: 7 }] },
  ];

  if (data.attendees.length > 0) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      contents: [
        { type: "text", text: "ผู้เข้าร่วม:", color: "#888888", size: "sm" },
        {
          type: "text",
          text: data.attendees.map((name, i) => `${i + 1}. ${name}`).join("\n"),
          color: "#111111",
          size: "sm",
          wrap: true,
          margin: "xs"
        }
      ]
    });
  }

  if (data.updatedByName) {
    bodyContents.push(
      { type: "separator", margin: "md" },
      { type: "box", layout: "horizontal", margin: "md", contents: [{ type: "text", text: "แก้ไขโดย:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.updatedByName, color: "#d97706", size: "sm", weight: "bold", flex: 7 }] }
    );
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "แก้ไขการจองห้องประชุม", weight: "bold", size: "lg", color: "#ffffff" }
      ],
      backgroundColor: "#d97706"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents
    }
  };

  const results = await Promise.all(
    allTargets.map(id => sendLineMessage(id!, [{ type: "flex", altText: `แก้ไขการจองห้องประชุม: ${data.purpose}`, contents }]))
  );

  return results.every(r => r);
}

/**
 * Notify about Travel Allowance Claim
 */
export async function sendTravelClaimNotification(data: {
  id: string;
  employeeName: string;
  claimType: string;
  siteName: string;
  dateRange: string;
  amount: string;
  status: string;
  remark?: string;
  reportUrl?: string;
  hideButtons?: boolean;
}, lineUserIds: string[], replyToken?: string) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  if (lineUserIds.length === 0) return false;

  const statusColor = data.status === "approved" || data.status === "completed"
    ? "#059669"
    : data.status === "rejected" ? "#dc2626" : "#2563eb";

  const statusText = data.status === "pending_supervisor" ? "รออนุมัติ (หัวหน้า)" :
    data.status === "pending_admin" ? "รออนุมัติ (HR)" :
      data.status === "completed" ? "อนุมัติแล้ว" :
        data.status === "rejected" ? "ไม่อนุมัติ" : data.status;

  const flexMessage: any = {
    type: "flex",
    altText: `แจ้งเตือนคำขอเบี้ยเลี้ยง: ${data.employeeName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: statusColor,
        contents: [
          { type: "text", text: "คำขอเบิกเบี้ยเลี้ยง/ค่าที่พัก", color: "#ffffff", weight: "bold", size: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: data.employeeName, weight: "bold", size: "xl", color: "#111827" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สถานะ:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: statusText, color: statusColor, size: "sm", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ประเภท:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.claimType, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สถานที่:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.siteName, color: "#111827", size: "sm", flex: 4, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "วันที่:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.dateRange, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ค่าที่พัก:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.amount, color: "#111827", size: "sm", flex: 4 }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: []
      }
    }
  };

  if (data.remark) {
    flexMessage.contents.body.contents.push({
      type: "box",
      layout: "vertical",
      margin: "md",
      contents: [
        { type: "text", text: "หมายเหตุ:", color: "#6b7280", size: "sm" },
        { type: "text", text: data.remark, color: "#4b5563", size: "sm", wrap: true }
      ]
    });
  }

  if (data.reportUrl) {
    flexMessage.contents.footer.contents.push({
      type: "button",
      action: {
        type: "uri",
        label: "ดูรายงานการปฏิบัติงาน",
        uri: data.reportUrl
      },
      style: "secondary",
      height: "sm",
      margin: "sm"
    });
  }

  // Add Approve/Disapprove buttons if pending and not hidden
  if (!data.hideButtons && (data.status === "pending_supervisor" || data.status === "pending_admin")) {
    flexMessage.contents.footer.contents.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "md",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "อนุมัติ",
            data: `action=approve_travel&id=${data.id}`,
            displayText: "ดำเนินการอนุมัติเบี้ยเลี้ยง"
          },
          style: "primary",
          color: "#059669",
          height: "sm"
        },
        {
          type: "button",
          action: {
            type: "postback",
            label: "ไม่อนุมัติ",
            data: `action=reject_travel&id=${data.id}`,
            displayText: "ไม่อนุมัติเบี้ยเลี้ยง"
          },
          style: "primary",
          color: "#dc2626",
          height: "sm"
        }
      ]
    });
  }

  // Final notification logic
  if (replyToken) {
    return sendLineMessage("", [flexMessage], replyToken);
  }
  const results = await Promise.all(lineUserIds.map(id => sendLineMessage(id, [flexMessage])));
  return results.some(r => r === true);
}
/**
 * Send Travel Claim Summary to Management
 */
export async function sendManagementTravelSummary(data: {
  empName: string;
  claimType: string;
  siteName: string;
  dateRange: string;
  amount: string;
  hrName: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;

  const flexMessage: any = {
    type: "flex",
    altText: `สรุปการเบิกเบี้ยเลี้ยง: ${data.empName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1e293b",
        contents: [
          { type: "text", text: "สรุปการเบิกเบี้ยเลี้ยง (ฝ่ายบริหาร)", color: "#ffffff", weight: "bold", size: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: data.empName, weight: "bold", size: "xl", color: "#111827" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ประเภท:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.claimType, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สถานที่:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.siteName, color: "#111827", size: "sm", flex: 4, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "วันที่:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.dateRange, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "จำนวนเงิน:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.amount, color: "#059669", size: "sm", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ผู้อนุมัติ (HR):", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.hrName, color: "#111827", size: "sm", flex: 4 }
                ]
              }
            ]
          }
        ]
      }
    }
  };

  return sendLineMessage(managementId, [flexMessage]);
}

/**
 * Send Commission Claim Notification
 */
export async function sendCommissionClaimNotification(data: {
  id: string;
  employeeName: string;
  customerName: string;
  date: string;
  totalAmount: string;
  perPerson: string;
  status: string;
  hideButtons?: boolean;
}, lineUserIds: string[], replyToken?: string) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  if (lineUserIds.length === 0 && !replyToken) return false;

  const statusColor = data.status === "completed"
    ? "#059669"
    : data.status === "rejected" ? "#dc2626" : "#7c3aed";

  const statusText = data.status === "pending_supervisor" ? "รออนุมัติ (หัวหน้า)" :
    data.status === "pending_admin" ? "รออนุมัติ (HR)" :
      data.status === "completed" ? "อนุมัติแล้ว" :
        data.status === "rejected" ? "ไม่อนุมัติ" : data.status;

  const totalText = data.totalAmount === "0" || data.totalAmount === "0.00" ? "รอ HR คำนวณ" : `${data.totalAmount} THB`;
  const perPersonText = data.perPerson === "0" || data.perPerson === "0.00" ? "รอ HR คำนวณ" : `${data.perPerson} THB`;

  const flexMessage: any = {
    type: "flex",
    altText: `แจ้งเตือนคำขอค่าคอมมิชชั่น: ${data.employeeName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: statusColor,
        contents: [
          { type: "text", text: "คำขอเบิกค่าคอมมิชชั่น", color: "#ffffff", weight: "bold", size: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: data.employeeName, weight: "bold", size: "xl", color: "#111827" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สถานะ:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: statusText, color: statusColor, size: "sm", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ลูกค้า:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.customerName, color: "#111827", size: "sm", flex: 4, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "วันที่:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.date, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ยอดรวม:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: totalText, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ต่อคน:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: perPersonText, color: "#059669", size: "sm", weight: "bold", flex: 4 }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: []
      }
    }
  };

  if (!data.hideButtons && (data.status === "pending_supervisor" || data.status === "pending_admin")) {
    flexMessage.contents.footer.contents.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "md",
      contents: [
        {
          type: "button",
          action: {
            type: "postback",
            label: "อนุมัติ",
            data: `action=approve_commission&id=${data.id}`,
            displayText: "ดำเนินการอนุมัติค่าคอมฯ"
          },
          style: "primary",
          color: "#059669",
          height: "sm"
        },
        {
          type: "button",
          action: {
            type: "postback",
            label: "ไม่อนุมัติ",
            data: `action=reject_commission&id=${data.id}`,
            displayText: "ไม่อนุมัติค่าคอมฯ"
          },
          style: "primary",
          color: "#dc2626",
          height: "sm"
        }
      ]
    });
  }

  if (replyToken) {
    return sendLineMessage("", [flexMessage], replyToken);
  }
  const results = await Promise.all(lineUserIds.map(id => sendLineMessage(id, [flexMessage])));
  return results.some(r => r === true);
}

export async function sendHrCommissionNotification(data: {
  id: string;
  employeeName: string;
  customerName: string;
  date: string;
  totalAmount: string;
  perPerson: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const hrLineUserId = process.env.HR_LINE_USER_ID;
  if (!hrLineUserId) return false;
  return sendCommissionClaimNotification({ ...data, status: "pending_admin" }, [hrLineUserId]);
}

export async function sendManagementCommissionSummary(data: {
  empName: string;
  customerName: string;
  date: string;
  amount: string;
  perPerson: string;
  hrName: string;
}) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
    if ((data as any).supervisorName) (data as any).supervisorName = await formatNameDb((data as any).supervisorName);
    if ((data as any).hrName) (data as any).hrName = await formatNameDb((data as any).hrName);
  }

  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;

  const flexMessage: any = {
    type: "flex",
    altText: `สรุปค่าคอมมิชชั่น: ${data.empName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1e293b",
        contents: [
          { type: "text", text: "สรุปการเบิกค่าคอมมิชชั่น (ฝ่ายบริหาร)", color: "#ffffff", weight: "bold", size: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: data.empName, weight: "bold", size: "xl", color: "#111827" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ลูกค้า:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.customerName, color: "#111827", size: "sm", flex: 4, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "วันที่:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.date, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ยอดรวม:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: `${data.amount} THB`, color: "#111827", size: "sm", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ต่อคน:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: `${data.perPerson} THB`, color: "#059669", size: "sm", weight: "bold", flex: 4 }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ผู้อนุมัติ (HR):", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: data.hrName, color: "#111827", size: "sm", flex: 4 }
                ]
              }
            ]
          }
        ]
      }
    }
  };

  return sendLineMessage(managementId, [flexMessage]);
}

export async function sendWorkPlanNotification(
  targetId: string,
  data: {
    empName: string;
    deptName?: string;
    morningPlan: string;
    morningLoc: string;
    afternoonPlan: string;
    afternoonLoc: string;
    otPlan?: string;
    otLoc?: string;
    otAttendant?: string;
  }
) {
  const empName = await formatNameDb(data.empName);

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "📋 แผนงานประจำวัน", weight: "bold", size: "lg", color: "#b91c1c" },
        { type: "text", text: `คุณ ${empName}`, size: "sm", color: "#4b5563", margin: "xs" },
        { type: "text", text: `แผนก: ${data.deptName || "-"}`, size: "xs", color: "#6b7280" }
      ],
      backgroundColor: "#fef2f2",
      paddingAll: "16px"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        // Morning
        {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🕒 เช้า (08:00 - 12:00)", weight: "bold", size: "sm", color: "#111827" },
            { type: "text", text: `📍 ${data.morningLoc}`, size: "xs", color: "#ef4444", margin: "xs" },
            { type: "text", text: data.morningPlan?.trim() || "-", size: "sm", color: "#374151", wrap: true, margin: "xs" }
          ]
        },
        { type: "separator" },
        // Afternoon
        {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🕒 บ่าย (13:00 - 17:00)", weight: "bold", size: "sm", color: "#111827" },
            { type: "text", text: `📍 ${data.afternoonLoc}`, size: "xs", color: "#ef4444", margin: "xs" },
            { type: "text", text: data.afternoonPlan?.trim() || "-", size: "sm", color: "#374151", wrap: true, margin: "xs" }
          ]
        }
      ]
    }
  };

  if (data.otPlan) {
    contents.body.contents.push(
      { type: "separator" },
      {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🌙 ล่วงเวลา (หลัง 17:00)", weight: "bold", size: "sm", color: "#7c3aed" },
          { type: "text", text: `📍 ${data.otLoc || "-"}`, size: "xs", color: "#8b5cf6", margin: "xs" },
          { type: "text", text: data.otPlan?.trim() || "-", size: "sm", color: "#374151", wrap: true, margin: "xs" },
          { type: "text", text: `👤 ผู้ดูแล: ${data.otAttendant || "-"}`, size: "xs", color: "#6b7280", margin: "sm" }
        ]
      }
    );
  }

  return sendLineMessage(targetId, [{ type: "flex", altText: `แผนงาน: ${empName}`, contents }]);
}

export async function sendWorkPlanNotificationBatch(
  targetId: string,
  plansData: Array<{
    empName: string;
    deptName?: string;
    morningPlan: string;
    morningLoc: string;
    afternoonPlan: string;
    afternoonLoc: string;
    otPlan?: string;
    otLoc?: string;
    otAttendant?: string;
  }>
) {
  if (plansData.length === 0) return true;

  // We chunk them into groups of 10 people per message card
  const maxPeoplePerCard = 10;
  let successAll = true;

  for (let i = 0; i < plansData.length; i += maxPeoplePerCard) {
    const chunk = plansData.slice(i, i + maxPeoplePerCard);

    const bodyContents: any[] = [];

    for (let j = 0; j < chunk.length; j++) {
      const data = chunk[j];
      const empName = await formatNameDb(data.empName);

      const personBox: any = {
        type: "box",
        layout: "vertical",
        margin: j === 0 ? "none" : "lg",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `👤 ${empName} (${data.deptName || "-"})`,
            weight: "bold",
            size: "sm",
            color: "#1e293b",
            wrap: true
          },
          {
            type: "text",
            text: `📍 เช้า: ${data.morningLoc} | ${data.morningPlan?.trim() || "-"}`,
            size: "xs",
            color: "#475569",
            wrap: true
          },
          {
            type: "text",
            text: `📍 บ่าย: ${data.afternoonLoc} | ${data.afternoonPlan?.trim() || "-"}`,
            size: "xs",
            color: "#475569",
            wrap: true
          }
        ]
      };

      if (data.otPlan) {
        personBox.contents.push({
          type: "text",
          text: `🌙 OT: ${data.otLoc || "-"} | ${data.otPlan?.trim() || "-"}`,
          size: "xs",
          color: "#7c3aed",
          wrap: true
        });
      }

      bodyContents.push(personBox);

      if (j < chunk.length - 1) {
        bodyContents.push({ type: "separator", margin: "lg" });
      }
    }

    const bubble: any = {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: `📋 สรุปแผนงาน (${chunk.length} ท่าน)`, weight: "bold", size: "lg", color: "#b91c1c" }
        ],
        backgroundColor: "#fef2f2",
        paddingAll: "16px"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: bodyContents
      }
    };

    const flexMessage = {
      type: "flex",
      altText: `สรุปแผนงานประจำวัน (${chunk.length} ท่าน)`,
      contents: bubble
    };

    const res = await sendLineMessage(targetId, [flexMessage]);
    if (!res) successAll = false;
  }

  return successAll;
}

export async function sendWelfareApprovalFlexMessage(
  lineUserId: string,
  data: {
    id: string;
    empName: string;
    welfareType: string;
    amount: string;
    createdAt: string;
    remark?: string;
    metadata?: Record<string, any>;
    attachmentUrls?: string[];
    supervisorName?: string;
    approvedBy?: string;
  },
  isProcessed: boolean = false,
  replyToken?: string
) {
  // Format names with nicknames
  if (data.empName) data.empName = await formatNameDb(data.empName);
  if (data.supervisorName) data.supervisorName = await formatNameDb(data.supervisorName);
  if (data.approvedBy) data.approvedBy = await formatNameDb(data.approvedBy);

  const bodyContents: any[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "สวัสดิการ:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: data.welfareType, color: "#1d4ed8", size: "sm", weight: "bold", flex: 7 }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "จำนวนเงิน:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: `฿${data.amount}.-`, color: "#dc2626", size: "sm", weight: "bold", flex: 7 }
      ]
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "วันที่ยื่น:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: data.createdAt, color: "#111111", size: "sm", flex: 7 }
      ]
    }
  ];

  if (data.metadata) {
    const metaLabels: Record<string, string> = {
      child_name: "ชื่อบุตร",
      education_level: "ระดับการศึกษา",
      gpa: "เกรดเฉลี่ย",
      service_years_at_claim: "อายุงานที่ยื่น"
    };

    // Helper for education levels
    const eduLevels: Record<string, string> = {
      "P1_3": "ประถม (ป.1 - ป.3)",
      "P4_6": "ประถม (ป.4 - ป.6)",
      "M1_3": "มัธยมต้น (ม.1 - ม.3)",
      "M4_6": "มัธยมปลาย / ปวช.",
      "DIP_BACH": "ปวส. / ปริญญาตรี"
    };

    Object.entries(data.metadata).forEach(([k, v]) => {
      let displayVal = v;
      if (k === 'education_level') displayVal = eduLevels[v] || v;

      bodyContents.push({
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: `${metaLabels[k] || k}:`, color: "#888888", size: "xs", flex: 3 },
          { type: "text", text: String(displayVal), color: "#111111", size: "xs", flex: 7, wrap: true }
        ]
      });
    });
  }

  if (data.remark) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "หมายเหตุ:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: data.remark, color: "#111111", size: "sm", flex: 7, wrap: true }
      ]
    });
  }

  if (isProcessed && data.approvedBy) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "ผู้อนุมัติ:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: data.approvedBy, color: "#16a34a", size: "sm", weight: "bold", flex: 7 }
      ]
    });
  }

  // Attachments Grid
  if (data.attachmentUrls && data.attachmentUrls.length > 0) {
    const images = data.attachmentUrls.filter(url => url.match(/\.(jpeg|jpg|gif|png|webp)/i));
    const others = data.attachmentUrls.filter(url => !url.match(/\.(jpeg|jpg|gif|png|webp)/i));

    if (images.length > 0) {
      bodyContents.push({ type: "separator", margin: "md" });
      const grid = generateImageGrid(images);
      if (grid) bodyContents.push(grid);
    }

    if (others.length > 0) {
      others.forEach((url, i) => {
        bodyContents.push({
          type: "button",
          style: "link",
          height: "sm",
          action: {
            type: "uri",
            label: `เปิดไฟล์แนบ ${others.length > 1 ? i + 1 : ""}`,
            uri: url
          }
        });
      });
    }
  }

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: isProcessed ? "สวัสดิการ (ดำเนินการแล้ว)" : "คำขออนุมัติสวัสดิการ",
          weight: "bold",
          size: "lg",
          color: isProcessed ? "#64748b" : "#1d4ed8"
        }
      ],
      backgroundColor: isProcessed ? "#f1f5f9" : "#eff6ff"
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: bodyContents
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: isProcessed ? [
        {
          type: "text",
          text: `ดำเนินการแล้วโดย: ${data.approvedBy || "ผู้อนุมัติ"}`,
          color: "#16a34a",
          size: "xs",
          weight: "bold",
          align: "center",
          margin: "md"
        }
      ] : [
        {
          type: "button",
          style: "primary",
          color: "#22c55e",
          action: {
            type: "postback",
            label: "อนุมัติ",
            data: `action=approve_welfare&id=${data.id}`,
            displayText: "ฉันอนุมัติสวัสดิการนี้"
          }
        },
        {
          type: "button",
          style: "primary",
          color: "#ef4444",
          action: {
            type: "postback",
            label: "ไม่อนุมัติ",
            data: `action=reject_welfare&id=${data.id}`,
            displayText: "ฉันไม่อนุมัติสวัสดิการนี้"
          }
        }
      ]
    }
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: `คำขอสวัสดิการ: ${data.empName}`, contents }], replyToken);
}

export async function sendEmployeeWelfareStatusNotification(
  lineUserId: string,
  data: {
    empName: string;
    welfareType: string;
    amount: string;
    status: "approved" | "rejected" | "pending_hr";
    approvedBy?: string;
  }
) {
  if (data.empName) data.empName = await formatNameDb(data.empName);
  if (data.approvedBy) data.approvedBy = await formatNameDb(data.approvedBy);

  const statusConfig = {
    pending_hr: { headerText: "หัวหน้าอนุมัติแล้ว", headerBg: "#fff7ed", headerColor: "#ea580c", badgeText: "รอ HR ตรวจสอบ", badgeColor: "#ea580c" },
    approved: { headerText: "อนุมัติแล้ว", headerBg: "#f0fdf4", headerColor: "#16a34a", badgeText: "อนุมัติแล้ว", badgeColor: "#16a34a" },
    rejected: { headerText: "ไม่อนุมัติ", headerBg: "#fef2f2", headerColor: "#dc2626", badgeText: "ไม่อนุมัติ", badgeColor: "#dc2626" },
  };

  const cfg = statusConfig[data.status];

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: cfg.headerText, weight: "bold", size: "lg", color: cfg.headerColor }],
      backgroundColor: cfg.headerBg
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สวัสดิการ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.welfareType, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "จำนวนเงิน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `฿${data.amount}.-`, color: "#dc2626", size: "sm", weight: "bold", flex: 7 }] },
        { type: "separator", margin: "md" },
        { type: "box", layout: "horizontal", margin: "md", contents: [{ type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: cfg.badgeText, color: cfg.badgeColor, size: "sm", weight: "bold", flex: 7 }] }
      ]
    }
  };

  if (data.approvedBy) {
    contents.body.contents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: data.approvedBy, color: "#111111", size: "sm", flex: 7 }
      ]
    });
  }

  return sendLineMessage(lineUserId, [{ type: "flex", altText: `สถานะสวัสดิการ: ${data.welfareType}`, contents }]);
}

export async function sendHrWelfareNotification(
  data: {
    id: string;
    empName: string;
    welfareType: string;
    amount: string;
    createdAt: string;
    remark?: string;
    metadata?: Record<string, any>;
    attachmentUrls?: string[];
    supervisorName?: string;
  }
) {
  const hrLineConfig = process.env.HR_LINE_USER_ID || "";
  if (!hrLineConfig) return false;
  const hrLineIds = hrLineConfig.split(",").map(id => id.trim());

  const results = await Promise.all(
    hrLineIds.map(id => sendWelfareApprovalFlexMessage(id, data))
  );
  return results.every(r => r === true);
}

/**
 * Sends a real-time Product Borrowing notification
 */
export async function sendProductBorrowNotification(
  data: {
    empName: string;
    productName: string;
    productCode: string;
    borrowDate: string;
    returnDate: string;
    location: string;
    jobTitle?: string;
    branchName?: string;
    photoUrl?: string;
    extraTargetIds?: string[];
    remark?: string;
    companyName?: string;
  }
) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
  }

  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  let targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  // Merge extra targets
  if (data.extraTargetIds && data.extraTargetIds.length > 0) {
    const uniqueExtras = data.extraTargetIds.filter(id => id && !targetIds.includes(id));
    targetIds = [...targetIds, ...uniqueExtras];
  }

  if (targetIds.length === 0) return false;

  const photos = parsePhotoData(data.photoUrl);
  const heroComponent = generateImageGrid(photos);

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "บันทึกการยืมสินค้า / สิ่งของ", weight: "bold", size: "lg", color: "#1e293b" }
      ],
      backgroundColor: "#fefce8"
    },
    hero: heroComponent || undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box", layout: "vertical", spacing: "sm", contents: [
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
            ...(data.jobTitle ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ตำแหน่ง:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.jobTitle, color: "#64748b", size: "sm", flex: 7 }] }] : []),
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สินค้า:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.productName} (${data.productCode})`, color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] },
            ...(data.companyName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริษัท:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.companyName, color: "#111111", size: "sm", flex: 7 }] }] : []),
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่ยืม:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.borrowDate, color: "#111111", size: "sm", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "กำหนดคืน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.returnDate, color: "#ca8a04", size: "sm", weight: "bold", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สถานที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.location || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] },
            ...(data.remark ? [{ type: "text", text: `หมายเหตุ: ${data.remark}`, size: "xs", color: "#6b7280", margin: "md", style: "italic", wrap: true }] : [])
          ]
        }
      ]
    }
  };

  const results = await Promise.all(
    targetIds.map(id => sendLineMessage(id, [{ type: "flex", altText: `ยืมสินค้า: ${data.productName}`, contents }]))
  );
  return results.every(r => r);
}

/**
 * Sends a real-time Product Returning notification
 */
export async function sendProductReturnNotification(
  data: {
    empName: string;
    productName: string;
    productCode: string;
    actualReturnDate: string;
    condition: string;
    isDamaged: boolean;
    jobTitle?: string;
    photoUrl?: string;
    extraTargetIds?: string[];
    companyName?: string;
  }
) {
  // Format names with nicknames
  if (data) {
    if ((data as any).empName) (data as any).empName = await formatNameDb((data as any).empName);
  }

  const hrManagerId = process.env.HR_LINE_USER_ID;
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  let targetIds = [hrManagerId, managementId].filter(id => !!id) as string[];

  // Merge extra targets
  if (data.extraTargetIds && data.extraTargetIds.length > 0) {
    const uniqueExtras = data.extraTargetIds.filter(id => id && !targetIds.includes(id));
    targetIds = [...targetIds, ...uniqueExtras];
  }

  if (targetIds.length === 0) return false;

  const photos = parsePhotoData(data.photoUrl);
  const heroComponent = generateImageGrid(photos);

  const contents: any = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "แจ้งคืนสินค้า / สิ่งของ", weight: "bold", size: "lg", color: "#1e293b" }
      ],
      backgroundColor: "#f0fdf4"
    },
    hero: heroComponent || undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box", layout: "vertical", spacing: "sm", contents: [
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สินค้า:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${data.productName} (${data.productCode})`, color: "#111111", size: "sm", weight: "bold", flex: 7, wrap: true }] },
            ...(data.companyName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริษัท:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.companyName, color: "#111111", size: "sm", flex: 7 }] }] : []),
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่คืน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.actualReturnDate, color: "#16a34a", size: "sm", weight: "bold", flex: 7 }] },
            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สภาพสินค้า:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: data.condition || "ปกติ", color: data.isDamaged ? "#dc2626" : "#111111", size: "sm", flex: 7, wrap: true }] }
          ]
        }
      ]
    }
  };

  const results = await Promise.all(
    targetIds.map(id => sendLineMessage(id, [{ type: "flex", altText: `คืนสินค้า: ${data.productName}`, contents }]))
  );
  return results.every(r => r);
}

export async function sendDepartmentLeaveNotification(
  lineUserId: string,
  leaveData: {
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
    departmentName: string;
  }
) {
  // Format names with nicknames
  if (leaveData) {
    if ((leaveData as any).empName) (leaveData as any).empName = await formatNameDb((leaveData as any).empName);
  }

  const contents = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#f0f9ff",
      contents: [
        { type: "text", text: `แจ้งเตือนการลา (${leaveData.departmentName})`, weight: "bold", color: "#0284c7", size: "sm" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พนักงาน:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.empName, color: "#111111", size: "sm", weight: "bold", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ประเภท:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.leaveType, color: "#111111", size: "sm", flex: 7 }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: `${leaveData.startDate} ถึง ${leaveData.endDate} (${formatLeaveMins(leaveData.minutes)})`, color: "#111111", size: "sm", flex: 7, wrap: true }] },
        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.reason || "-", color: "#111111", size: "sm", flex: 7, wrap: true }] }
      ]
    }
  };

  return sendLineMessage(lineUserId, [{ type: "flex", altText: `แจ้งเตือนการลา: ${leaveData.empName}`, contents: contents as any }]);
}


export async function sendTripFeeApprovalRequest(
  supervisorLineId: string,
  borrowing: {
    id: number;
    empName: string;
    assetName: string;
    borrowDate: string;
    returnDate: string;
    nightsCount: number;
  }
) {
  if (!supervisorLineId) return false;

  const flexMessage = {
    type: "flex",
    altText: `คำขออนุมัติค่าเที่ยวขับรถจาก ${borrowing.empName}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "อนุมัติค่าเที่ยวขับรถ",
            weight: "bold",
            color: "#ffffff",
            size: "md"
          }
        ],
        backgroundColor: "#0ea5e9"
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "พนักงาน:", color: "#aaaaaa", size: "sm", flex: 3 },
              { type: "text", text: borrowing.empName, color: "#333333", size: "sm", flex: 7, wrap: true }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "รถ:", color: "#aaaaaa", size: "sm", flex: 3 },
              { type: "text", text: borrowing.assetName, color: "#333333", size: "sm", flex: 7, wrap: true }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ค้างคืน:", color: "#aaaaaa", size: "sm", flex: 3 },
              { type: "text", text: `${borrowing.nightsCount} คืน`, color: "#333333", size: "sm", flex: 7 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ยืม:", color: "#aaaaaa", size: "sm", flex: 3 },
              { type: "text", text: borrowing.borrowDate, color: "#333333", size: "sm", flex: 7 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "คืน:", color: "#aaaaaa", size: "sm", flex: 3 },
              { type: "text", text: borrowing.returnDate, color: "#333333", size: "sm", flex: 7 }
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
              label: "✅ อนุมัติ",
              data: `action=approve_trip_fee&id=${borrowing.id}`,
              displayText: "อนุมัติค่าเที่ยว"
            }
          },
          {
            type: "button",
            style: "secondary",
            color: "#ef4444",
            action: {
              type: "postback",
              label: "❌ ไม่อนุมัติ",
              data: `action=reject_trip_fee&id=${borrowing.id}`,
              displayText: "ไม่อนุมัติค่าเที่ยว"
            }
          }
        ]
      }
    }
  };

  try {
    return sendLineMessage(supervisorLineId, [flexMessage]);
  } catch (error) {
    console.error("Error sending trip fee approval message:", error);
    return false;
  }
}
