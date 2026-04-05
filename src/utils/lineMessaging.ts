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
  
  const url = replyToken 
    ? "https://api.line.me/v2/bot/message/reply" 
    : "https://api.line.me/v2/bot/message/push";
    
  const body: any = { messages };
  if (replyToken) body.replyToken = replyToken;
  else body.to = to;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch (e) {
    console.error("[LINE UTILS] sendLineMessage error:", e);
    return false;
  }
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
    quotaMins?: number;
    usedMins?: number;
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
    }
  ];

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

export async function sendEmployeeLeaveStatusNotification(
  lineUserId: string,
  leaveData: {
    empName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    minutes: number;
    reason: string;
    status: "pending_supervisor" | "pending_hr" | "approved" | "rejected";
    approvedBy?: string;
    rejectionReason?: string;
  }
) {
  const statusConfig = {
    pending_hr: { headerText: "รอ HR อนุมัติ", headerBg: "#fff7ed", headerColor: "#ea580c", badgeText: "รอ HR อนุมัติ", badgeColor: "#ea580c", altText: "ใบลาของคุณรอ HR อนุมัติ" },
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
    { type: "separator", margin: "lg" },
    { type: "box", layout: "horizontal", margin: "lg", contents: [{ type: "text", text: "สถานะ:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: cfg.badgeText, color: cfg.badgeColor, size: "sm", weight: "bold", flex: 7 }] }
  ];

  if (leaveData.approvedBy) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "โดย:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.approvedBy, color: "#111111", size: "sm", flex: 7 }] });
  if (leaveData.status === "rejected" && leaveData.rejectionReason) bodyContents.push({ type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล:", color: "#888888", size: "sm", flex: 3 }, { type: "text", text: leaveData.rejectionReason, color: "#dc2626", size: "sm", flex: 7, wrap: true }] });
  if (leaveData.status === "pending_hr") bodyContents.push({ type: "text", text: "หัวหน้าอนุมัติแล้ว กำลังรอ HR อนุมัติขั้นสุดท้าย", color: "#9ca3af", size: "xs", margin: "md", wrap: true });

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
  empName: string; leaveType: string; startDate: string; endDate: string; minutes: number; reason: string; supervisorName: string; hrName: string;
}) {
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;
  const text = [
    "ข้อมูลการอนุมัติลา (สรุป)",
    `พนักงาน: ${data.empName}`,
    `ประเภท: ${data.leaveType}`,
    `วันที่: ${data.startDate} ถึง ${data.endDate} (${formatLeaveMins(data.minutes)})`,
    `เหตุผล: ${data.reason || "-"}`,
    `หัวหน้างานที่อนุมัติ: ${data.supervisorName}`,
    `HR ที่อนุมัติ: ${data.hrName}`
  ].join("\n");
  return sendLineMessage(managementId, [{ type: "text", text }]);
}

export async function sendManagementOtSummary(data: {
  empName: string; dateFor: string; startTime: string; endTime: string; totalHours: number; reason: string; supervisorName: string; hrName: string;
}) {
  const managementId = process.env.MANAGEMENT_LINE_USER_ID;
  if (!managementId) return false;
  const text = [
    "ข้อมูลการอนุมัติ OT (สรุป)",
    `พนักงาน: ${data.empName}`,
    `วันที่: ${data.dateFor}`,
    `เวลา: ${data.startTime} - ${data.endTime} (${data.totalHours} ชม.)`,
    `เหตุผล: ${data.reason || "-"}`,
    `หัวหน้างานที่อนุมัติ: ${data.supervisorName}`,
    `HR ที่อนุมัติ: ${data.hrName}`
  ].join("\n");
  return sendLineMessage(managementId, [{ type: "text", text }]);
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
