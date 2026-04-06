import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayBangkokISO } from "@/utils/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || "hr-checkin-secret-123";

async function pushLineMessage(to: string, messages: any[]) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) {
        console.error("[DIAG-PROBATION] LINE_CHANNEL_ACCESS_TOKEN is missing");
        return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN_MISSING" };
    }
    try {
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({ to, messages }),
        });
        const text = await res.text();
        if (!res.ok) {
            console.error(`[DIAG-PROBATION] LINE API error ${res.status}:`, text);
        }
        return { ok: res.ok, status: res.status, body: text };
    } catch (e: any) {
        console.error("[DIAG-PROBATION] Exception:", e.message);
        return { ok: false, error: e.message };
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");
    const dryRun = searchParams.get("dry_run") === "1"; // ?dry_run=1 → skip sending

    if (secret !== CRON_SECRET) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    try {
        // ── 1. Find Ms. Duangkamol ──
        const emp = await prisma.employees.findFirst({
            where: {
                name: { contains: "ดวงกมล", mode: "insensitive" },
                is_active: true,
            },
            include: {
                supervisor: {
                    select: { emp_id: true, name: true, line_user_id: true },
                },
                departments: { select: { name: true } },
                job_positions: { select: { title: true } },
            },
        });

        if (!emp) {
            return NextResponse.json({
                ok: false,
                error: "Employee 'ดวงกมล' not found or inactive",
            }, { status: 404 });
        }

        // ── 2. Compute probation details ──
        const todayStr = getTodayBangkokISO();
        const todayBkk = new Date(`${todayStr}T00:00:00+07:00`);

        let evaluationLabel = "";
        let daysUntilEnd: number | null = null;
        let endDateLabel = "";

        if (emp.probation_end_date) {
            // Custom end date
            const endDate = new Date(emp.probation_end_date);
            endDate.setHours(0, 0, 0, 0);
            const diffMs = endDate.getTime() - todayBkk.getTime();
            daysUntilEnd = Math.round(diffMs / (1000 * 60 * 60 * 24));
            evaluationLabel = "สิ้นสุดทดลองงาน";
            endDateLabel = endDate.toLocaleDateString("th-TH", {
                year: "numeric", month: "long", day: "numeric"
            });
        } else if (emp.hire_date) {
            const hireDate = new Date(emp.hire_date);
            hireDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor(
                (todayBkk.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            // Determine which milestone is upcoming
            const milestones = [30, 60, 90];
            const next = milestones.find(m => m > diffDays);
            if (next) {
                daysUntilEnd = next - diffDays;
                evaluationLabel = `ครบรอบ ${next} วัน`;
                const target = new Date(hireDate.getTime() + next * 24 * 60 * 60 * 1000);
                endDateLabel = target.toLocaleDateString("th-TH", {
                    year: "numeric", month: "long", day: "numeric"
                });
            } else {
                evaluationLabel = "ครบกำหนดทดลองงานแล้ว (เกิน 90 วัน)";
                daysUntilEnd = 0;
                endDateLabel = "-";
            }
        } else {
            evaluationLabel = "ไม่ระบุวันเริ่มงาน";
            daysUntilEnd = null;
            endDateLabel = "-";
        }

        const supervisorLineId = emp.supervisor?.line_user_id ?? null;
        const hireDateLabel = emp.hire_date
            ? new Date(emp.hire_date).toLocaleDateString("th-TH", {
                year: "numeric", month: "long", day: "numeric"
            })
            : "ไม่ระบุ";

        // ── 3. Build Flex Message ──
        const daysText =
            daysUntilEnd === null
                ? "ไม่ทราบ"
                : daysUntilEnd === 0
                ? "วันนี้คือวันประเมิน"
                : daysUntilEnd < 0
                ? `เกินกำหนดมาแล้ว ${Math.abs(daysUntilEnd)} วัน`
                : `อีก ${daysUntilEnd} วัน`;

        const urgencyColor =
            daysUntilEnd !== null && daysUntilEnd <= 1
                ? "#dc2626"
                : daysUntilEnd !== null && daysUntilEnd <= 3
                ? "#ea580c"
                : "#0369a1";

        const headerBg =
            daysUntilEnd !== null && daysUntilEnd <= 3 ? "#fff7ed" : "#f0f9ff";
        const headerColor =
            daysUntilEnd !== null && daysUntilEnd <= 3 ? "#c2410c" : "#0369a1";

        const flexContent = {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                backgroundColor: headerBg,
                paddingAll: "16px",
                contents: [
                    {
                        type: "text",
                        text: "แจ้งเตือนประเมินทดลองงาน",
                        weight: "bold",
                        size: "lg",
                        color: headerColor,
                    },
                    {
                        type: "text",
                        text: `การประเมิน: ${evaluationLabel}`,
                        size: "sm",
                        color: "#6b7280",
                        margin: "sm",
                    },
                ],
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                paddingAll: "16px",
                contents: [
                    {
                        type: "text",
                        text: `สวัสดีคุณ ${emp.supervisor?.name ?? "หัวหน้างาน"}`,
                        size: "sm",
                        color: "#6b7280",
                    },
                    {
                        type: "text",
                        text: "กรุณาแจ้งผลการประเมินทดลองงานของพนักงานด้านล่างนี้:",
                        size: "sm",
                        color: "#111827",
                        wrap: true,
                        margin: "md",
                    },
                    // Employee Info Box
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        spacing: "xs",
                        backgroundColor: "#f8fafc",
                        paddingAll: "12px",
                        cornerRadius: "8px",
                        contents: [
                            {
                                type: "text",
                                text: `ชื่อ: ${emp.name}`,
                                size: "sm",
                                weight: "bold",
                                color: "#1e293b",
                            },
                            {
                                type: "text",
                                text: `รหัสพนักงาน: ${emp.emp_id}`,
                                size: "xs",
                                color: "#64748b",
                                margin: "xs",
                            },
                            ...(emp.job_positions?.title
                                ? [{
                                    type: "text",
                                    text: `ตำแหน่ง: ${emp.job_positions.title}`,
                                    size: "xs",
                                    color: "#64748b",
                                    margin: "xs",
                                }]
                                : []),
                            ...(emp.departments?.name
                                ? [{
                                    type: "text",
                                    text: `แผนก: ${emp.departments.name}`,
                                    size: "xs",
                                    color: "#64748b",
                                    margin: "xs",
                                }]
                                : []),
                            {
                                type: "text",
                                text: `วันเริ่มงาน: ${hireDateLabel}`,
                                size: "xs",
                                color: "#64748b",
                                margin: "xs",
                            },
                        ],
                    },
                    // Deadline Box
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        backgroundColor: "#fefce8",
                        paddingAll: "10px",
                        cornerRadius: "8px",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "กำหนดประเมิน:",
                                        size: "xs",
                                        color: "#92400e",
                                        flex: 4,
                                    },
                                    {
                                        type: "text",
                                        text: endDateLabel,
                                        size: "xs",
                                        color: "#92400e",
                                        weight: "bold",
                                        flex: 6,
                                        align: "end",
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                margin: "xs",
                                contents: [
                                    {
                                        type: "text",
                                        text: "เวลาที่เหลือ:",
                                        size: "xs",
                                        color: "#92400e",
                                        flex: 4,
                                    },
                                    {
                                        type: "text",
                                        text: daysText,
                                        size: "xs",
                                        color: urgencyColor,
                                        weight: "bold",
                                        flex: 6,
                                        align: "end",
                                    },
                                ],
                            },
                        ],
                    },
                    // Call to action
                    {
                        type: "text",
                        text: "กรุณาติดต่อฝ่าย HR เพื่อส่งผลการประเมิน",
                        size: "xs",
                        color: "#9ca3af",
                        margin: "xxl",
                        align: "center",
                        style: "italic",
                        wrap: true,
                    },
                ],
            },
        };

        // ── 4. Send (or dry-run) ──
        let lineResult: any = { skipped: true, reason: "dry_run" };

        if (!dryRun && supervisorLineId) {
            lineResult = await pushLineMessage(supervisorLineId, [
                {
                    type: "flex",
                    altText: `แจ้งเตือนประเมินทดลองงาน: ${emp.name} (${evaluationLabel})`,
                    contents: flexContent,
                },
            ]);
        } else if (!supervisorLineId) {
            lineResult = { skipped: true, reason: "NO_SUPERVISOR_LINE_ID" };
        }

        return NextResponse.json({
            ok: true,
            dryRun,
            employee: {
                emp_id: emp.emp_id,
                name: emp.name,
                hire_date: emp.hire_date,
                probation_end_date: emp.probation_end_date,
                is_on_trial: emp.is_on_trial,
                department: emp.departments?.name,
                position: emp.job_positions?.title,
            },
            supervisor: {
                name: emp.supervisor?.name ?? null,
                emp_id: emp.supervisor?.emp_id ?? null,
                has_line_id: !!supervisorLineId,
            },
            evaluation: {
                label: evaluationLabel,
                daysUntilEnd,
                endDateLabel,
            },
            lineResult,
        });
    } catch (error: any) {
        console.error("[DIAG-PROBATION] Fatal error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
