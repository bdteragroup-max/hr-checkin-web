import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}

function formatThaiDate(date: Date | null | undefined, format: "short" | "long" = "short") {
    if (!date) return "-";
    const d = new Date(date);
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getUTCFullYear() + 543; // Buddhist Year

    const monthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthsLong = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

    const m = format === "short" ? monthsShort[month] : monthsLong[month];
    return `${day} ${m} ${year.toString().slice(-2)}`;
}

function calculateWorkAge(hireDate: Date | null | undefined) {
    if (!hireDate) return "-";
    const hire = new Date(hireDate);
    const now = new Date();

    let years = now.getUTCFullYear() - hire.getUTCFullYear();
    let months = now.getUTCMonth() - hire.getUTCMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    if (years > 0) {
        return `${years} ปี ${months} เดือน`;
    }
    return `${months} เดือน`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id: idStr } = await params;
        const id = parseInt(idStr);

        const evalData = await prisma.kpi_evaluations.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        name: true,
                        emp_id: true,
                        hire_date: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } },
                        supervisor: { select: { name: true } }
                    }
                },
                supervisor: { select: { name: true } },
                items: true
            }
        });

        if (!evalData) return NextResponse.json({ error: "EVALUATION_NOT_FOUND" }, { status: 404 });

        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const fontRegularBytes = await loadFontBytes("public/fonts/Sarabun-Regular.ttf");
        const fontBoldBytes = await loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null);
        const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: true });
        const fontBold = fontBoldBytes ? await pdf.embedFont(fontBoldBytes, { subset: true }) : fontRegular;

        const isAnnual = evalData.category === "ANNUAL";

        // PAGE CONFIG: Landscape for Annual, Portrait for Probation
        const PAGE_SIZE: [number, number] = isAnnual ? [841.89, 595.28] : [595.28, 841.89];
        let page = pdf.addPage(PAGE_SIZE);
        const { width, height } = page.getSize();

        // Colors
        const PRIMARY_RED = rgb(0.85, 0.1, 0.1);
        const BLACK = rgb(0, 0, 0);
        const GRAY_BG = rgb(0.95, 0.95, 0.95);
        const GRAY_BORDER = rgb(0.8, 0.8, 0.8);
        const GRAY_TEXT = rgb(0.4, 0.4, 0.4);

        const ML = 40;
        const MR = width - 40;
        const FULL_W = MR - ML;
        let y = height - 40;

        // --- 1. Formal Header Layout ---
        const title = isAnnual ? "แบบประเมินผลการปฏิบัติงานประจำปี (Annual Evaluation)" : 
                      evalData.category === "MONTHLY" ? "แบบประเมินผลการทำงานรายเดือน (Monthly Performance)" : "แบบประเมินผลการปฏิบัติงานทดลองงาน";
        const titleW = fontBold.widthOfTextAtSize(title, 14);
        page.drawText(title, { x: (width - titleW) / 2, y: y, size: 14, font: fontBold });
        y -= 30;

        const drawField = (label: string, value: string, x: number, currentY: number, w: number) => {
            page.drawText(label, { x, y: currentY, size: 9, font: fontRegular });
            const labelW = fontRegular.widthOfTextAtSize(label, 9);
            const valX = x + labelW + 5;
            const maxValW = w - labelW - 10;
            
            const wrapped = wrapText(value || "-", maxValW, fontBold, 9);
            wrapped.forEach((line, i) => {
                page.drawText(line, { x: valX, y: currentY - (i * 12), size: 9, font: fontBold });
            });
            
            const underlineY = currentY - (wrapped.length * 12) + 10;
            page.drawLine({ 
                start: { x: valX, y: underlineY }, 
                end: { x: x + w, y: underlineY }, 
                thickness: 0.5, 
                color: GRAY_BORDER 
            });

            return wrapped.length;
        };

        const col1 = ML;
        const col2 = ML + (FULL_W * 0.33);
        const col3 = ML + (FULL_W * 0.66);
        const fW = FULL_W * 0.3;

        const h1 = Math.max(
            drawField("ชื่อ-สกุล", evalData.employee.name, col1, y, fW),
            drawField("รหัสพนักงาน", evalData.employee.emp_id, col2, y, fW),
            drawField("อายุงาน", calculateWorkAge(evalData.employee.hire_date), col3, y, fW)
        );
        y -= (h1 * 12) + 8;
        
        const h2 = Math.max(
            drawField("ตำแหน่ง", evalData.employee.job_positions?.title || "-", col1, y, fW),
            drawField("แผนก/ฝ่าย", evalData.employee.departments?.name || "-", col2, y, fW),
            drawField("บริษัท", "เทอรา กรุ๊ป จำกัด", col3, y, fW)
        );
        y -= (h2 * 12) + 8;

        const h3 = Math.max(
            drawField("รอบประเมิน", isAnnual ? (evalData.session_name === "Mid-Year" ? "Mid-Year Assessment" : evalData.session_name || "-") : 
                                    evalData.category === "MONTHLY" ? `เดือน ${evalData.evaluation_no}` : `ครั้งที่ ${evalData.evaluation_no}`, col1, y, fW),
            drawField("ปี", isAnnual ? evalData.year?.toString() || "-" : "-", col2, y, fW),
            drawField("ระยะเวลา", `${formatThaiDate(evalData.period_start)} - ${formatThaiDate(evalData.period_end)}`, col3, y, fW)
        );
        y -= (h3 * 12) + 15;

        // --- RENDER PARTS ---
        const SECTIONS = (isAnnual)
            ? [{ id: "KPI", label: "ส่วนที่ 1: เป้าหมายการปฏิบัติงาน (Performance KPIs - 70%)" },
            { id: "CORE_VALUE", label: "ส่วนที่ 2: ค่านิยมหลัก (Core Values - 20%)" },
            { id: "COMPETENCY", label: "ส่วนที่ 3: ขีดความสามารถ (Competencies - 10%)" }]
            : [{ id: "KPI", label: `ส่วนที่ 1: เป้าหมายการปฏิบัติงาน (Performance KPIs - 100%)` }];

        for (const sec of SECTIONS) {
            const secItems = evalData.items.filter((it: { section: string; }) => it.section === sec.id || (!it.section && sec.id === "KPI"));
            if (secItems.length === 0) continue;

            // Section Bar
            page.drawRectangle({ x: ML, y: y - 18, width: FULL_W, height: 18, color: PRIMARY_RED });
            page.drawText(sec.label, { x: ML + 10, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
            y -= 25;

            // Table Header
            const CW = isAnnual ? [200, 160, 40, 100, 45, 45, 45, 50] : [120, 120, 40, 80, 40, 40, 40, 40];
            const CX = [ML];
            CW.forEach((w, i) => CX.push(CX[i] + w));

            const hH = 20;
            page.drawRectangle({ x: ML, y: y - hH, width: FULL_W, height: hH, color: rgb(0.9, 0.9, 0.9), borderColor: BLACK, borderWidth: 0.5 });
            const labels = ["หัวข้อ/เป้าหมาย", "ตัวชี้วัด", "น้ำหนัก", "ผลลัพธ์ที่ทำได้", "พนง.", "รวม พ.", "หนง.", "รวม ห."];
            labels.forEach((txt, i) => {
                const tw = fontBold.widthOfTextAtSize(txt, 7);
                page.drawText(txt, { x: CX[i] + (CW[i] - tw) / 2, y: y - 13, size: 7, font: fontBold });
            });
            y -= hH;

            // Body
            for (const item of secItems) {
                const wrapObj = wrapText(item.objective, CW[0] - 8, fontRegular, 7);
                const wrapInd = wrapText(item.indicator, CW[1] - 8, fontRegular, 7);
                const wrapRes = wrapText(item.result_description || "-", CW[3] - 8, fontRegular, 7);
                const rowH = Math.max(wrapObj.length, wrapInd.length, wrapRes.length) * 10 + 10;

                if (y - rowH < 60) {
                    page = pdf.addPage(PAGE_SIZE);
                    y = height - 60;
                }

                page.drawRectangle({ x: ML, y: y - rowH, width: FULL_W, height: rowH, borderColor: BLACK, borderWidth: 0.5 });
                wrapObj.forEach((l, i) => page.drawText(l, { x: CX[0] + 4, y: y - 12 - (i * 10), size: 7, font: fontBold }));
                wrapInd.forEach((l, i) => page.drawText(l, { x: CX[1] + 4, y: y - 12 - (i * 10), size: 7, font: fontRegular, color: GRAY_TEXT }));
                wrapRes.forEach((l, i) => page.drawText(l, { x: CX[3] + 4, y: y - 12 - (i * 10), size: 7, font: fontRegular }));

                const weight = Number(item.weight);
                const empS = Number(item.employee_score || 0);
                const supS = Number(item.supervisor_score || 0);

                const dc = (t: string, i: number, b = false) => {
                    const tw = (b ? fontBold : fontRegular).widthOfTextAtSize(t, 8);
                    page.drawText(t, { x: CX[i] + (CW[i] - tw) / 2, y: y - rowH / 2 - 3, size: 8, font: b ? fontBold : fontRegular });
                };

                dc(weight > 0 ? `${weight}%` : "-", 2, true);

                // Employee columns
                if (empS > 0) {
                    dc(empS.toString(), 4);
                    dc(weight > 0 ? ((weight / 100) * empS).toFixed(2) : "-", 5);
                } else {
                    // For Part 3, if no score, show N/A as it's supervisor-evaluated, else -
                    dc(sec.id === "COMPETENCY" ? "N/A" : "-", 4);
                    dc("-", 5);
                }

                // Supervisor columns
                if (supS > 0) {
                    dc(supS.toString(), 6, true);
                    dc(weight > 0 ? ((weight / 100) * supS).toFixed(2) : "-", 7, true);
                } else {
                    dc("-", 6, true);
                    dc("-", 7, true);
                }

                y -= rowH;
            }
            y -= 15;
        }

        // Part 4 & 5
        if (y < 150) { page = pdf.addPage(PAGE_SIZE); y = height - 60; }

        // Part 4: Development Goals Table (ANNUAL ONLY)
        if (isAnnual) {
            const devItems = evalData.items.filter((it: any) => it.section === "DEVELOPMENT");

            page.drawRectangle({ x: ML, y: y - 18, width: FULL_W, height: 18, color: rgb(0.2, 0.2, 0.2) });
            page.drawText("ส่วนที่ 4: แผนพัฒนาพนักงาน (Employee Development Plan)", { x: ML + 10, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
            y -= 25;

            if (devItems.length === 0) {
                page.drawRectangle({ x: ML, y: y - 40, width: FULL_W, height: 40, borderColor: BLACK, borderWidth: 0.5 });
                page.drawText("ไม่ได้ระบุเป้าหมายการพัฒนา", { x: ML + 10, y: y - 25, size: 9, font: fontRegular, color: GRAY_TEXT });
                y -= 55;
            } else {
                // Table Header
                const DW = isAnnual ? [180, 220, 140, 220] : [120, 140, 100, 155];
                const DX = [ML];
                DW.forEach((w, i) => DX.push(DX[i] + w));

                const hH = 20;
                page.drawRectangle({ x: ML, y: y - hH, width: FULL_W, height: hH, color: rgb(0.9, 0.9, 0.9), borderColor: BLACK, borderWidth: 0.5 });
                const labels = ["หัวข้อการพัฒนา", "เป้าหมาย/วิธีการ", "ระยะเวลา", "ผลลัพธ์ที่ได้"];
                labels.forEach((txt, i) => {
                    const tw = fontBold.widthOfTextAtSize(txt, 7);
                    page.drawText(txt, { x: DX[i] + (DW[i] - tw) / 2, y: y - 13, size: 7, font: fontBold });
                });
                y -= hH;

                for (const item of devItems) {
                    const wrapObj = wrapText(item.objective || "", DW[0] - 8, fontBold, 7);
                    const wrapInd = wrapText(item.indicator || "", DW[1] - 8, fontRegular, 7);
                    const wrapDur = wrapText(item.target_1 || "", DW[2] - 8, fontRegular, 7);
                    const wrapRes = wrapText(item.result_description || "", DW[3] - 8, fontRegular, 7);

                    // Increase line height for Thai (14 units per line instead of 10)
                    const LH = 14;
                    const rowH = Math.max(wrapObj.length, wrapInd.length, wrapDur.length, wrapRes.length) * LH + 10;

                    if (y - rowH < 60) {
                        page = pdf.addPage(PAGE_SIZE);
                        y = height - 60;
                    }

                    page.drawRectangle({ x: ML, y: y - rowH, width: FULL_W, height: rowH, borderColor: BLACK, borderWidth: 0.5 });

                    // Draw text with increased line height
                    wrapObj.forEach((l, i) => page.drawText(l, { x: DX[0] + 4, y: y - 16 - (i * LH), size: 7, font: fontBold }));
                    wrapInd.forEach((l, i) => page.drawText(l, { x: DX[1] + 4, y: y - 16 - (i * LH), size: 7, font: fontRegular, color: GRAY_TEXT }));
                    wrapDur.forEach((l, i) => page.drawText(l, { x: DX[2] + 4, y: y - 16 - (i * LH), size: 7, font: fontRegular }));
                    wrapRes.forEach((l, i) => page.drawText(l, { x: DX[3] + 4, y: y - 16 - (i * LH), size: 7, font: fontRegular, color: rgb(0.1, 0.5, 0.1) }));

                    y -= rowH;
                }
                y -= 15;
            }
        }

        if (y < 200) {
            page = pdf.addPage(PAGE_SIZE);
            y = height - 60;
        }

        page.drawRectangle({ x: ML, y: y - 18, width: FULL_W, height: 18, color: rgb(0.2, 0.2, 0.2) });
        page.drawText("ส่วนที่ 5: สรุปผลคะแนนและเกรด (Final Summary & Grade)", { x: ML + 10, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
        y -= 35;

        const finalScore = Number(evalData.total_supervisor_score).toFixed(2);
        page.drawText(`คะแนนรวมสุทธิ: ${finalScore} / 5.00`, { x: ML, y, size: 14, font: fontBold });

        // Reposition grade box further to the right
        const gradeBoxX = ML + 250;
        page.drawRectangle({ x: gradeBoxX, y: y - 8, width: 90, height: 30, color: rgb(1, 1, 0), borderColor: BLACK, borderWidth: 1 });
        page.drawText(`เกรด: ${evalData.grade || "-"}`, { x: gradeBoxX + 15, y: y + 2, size: 14, font: fontBold });

        // Show Pass/Fail or Salary recommendation
        if (evalData.category === "PROBATION" || evalData.category === "MONTHLY") {
            const isPassing = evalData.category === "PROBATION" ? evalData.is_passing : evalData.recommend_salary;
            const passText = isPassing ? "ผ่านการประเมิน (PASSED)" : "ไม่ผ่านการประเมิน (NOT PASSED)";
            const passColor = isPassing ? rgb(0.1, 0.6, 0.1) : rgb(0.8, 0.1, 0.1);
            page.drawText(passText, { x: ML, y: y - 25, size: 10, font: fontBold, color: passColor });
            y -= 45;
        } else {
            // ANNUAL
            const recText = evalData.recommend_salary ? "เสนอพิจารณาปรับเงินเดือน" : "ยังไม่เข้าเกณฑ์พิจารณาปรับเงินเดือน";
            page.drawText(`ข้อเสนอแนะ: ${recText}`, { x: ML, y: y - 25, size: 10, font: fontBold });
            y -= 45;
        }

        // --- Comments Section ---
        const drawCommentBox = (label: string, text: string, currentY: number) => {
            const wrapped = wrapText(text || "-", FULL_W - 20, fontRegular, 9);
            const boxH = Math.max(wrapped.length * 14 + 20, 40);

            if (currentY - boxH < 60) {
                page = pdf.addPage(PAGE_SIZE);
                currentY = height - 60;
            }

            page.drawText(label, { x: ML, y: currentY, size: 9, font: fontBold });
            page.drawRectangle({ x: ML, y: currentY - boxH - 5, width: FULL_W, height: boxH, borderColor: GRAY_BORDER, borderWidth: 0.5 });
            wrapped.forEach((l, i) => page.drawText(l, { x: ML + 10, y: currentY - 20 - (i * 14), size: 9, font: fontRegular }));

            return currentY - boxH - 25;
        };

        y = drawCommentBox("ความเห็นพนักงาน (Employee Comments):", evalData.employee_comment || "", y);
        y = drawCommentBox("ความเห็นผู้บังคับบัญชา (Supervisor Comments):", evalData.supervisor_comment || "", y);

        y -= 30;

        // Signatures Page Break Check
        if (y < 120) {
            page = pdf.addPage(PAGE_SIZE);
            y = height - 60;
        }

        // Signatures
        const sigX = [ML, ML + FULL_W * 0.35, ML + FULL_W * 0.7];
        sigX.forEach((x, i) => {
            const label = i === 0 ? "พนักงาน" : i === 1 ? "ผู้ประเมิน (หัวหน้า)" : "ฝ่ายบุคคล / ผู้บริหาร";
            page.drawLine({ start: { x, y: y }, end: { x: x + 150, y: y }, thickness: 0.5, color: BLACK });
            page.drawText(`(${label})`, { x: x + 75 - fontRegular.widthOfTextAtSize(`(${label})`, 8) / 2, y: y - 12, size: 8, font: fontRegular });
        });

        const bytes = await pdf.save();
        return new Response(Buffer.from(bytes), {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="KPI_Report_${evalData.id}.pdf"` },
        });

    } catch (e: any) {
        console.error("[PDF] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

function wrapText(txt: string, maxW: number, font: any, size: number): string[] {
    if (!txt) return [""];
    const lines: string[] = [];

    // First try splitting by spaces (for mixed English/Thai or spaced Thai)
    const segments = txt.split(" ");
    let currentLine = "";

    for (const segment of segments) {
        // If a single segment (word) is already too long, we must break it by character
        if (font.widthOfTextAtSize(segment, size) > maxW) {
            // Flush current line if not empty
            if (currentLine) {
                lines.push(currentLine.trim());
                currentLine = "";
            }

            // Character-by-character split for long Thai strings
            let charLine = "";
            for (const char of segment) {
                if (font.widthOfTextAtSize(charLine + char, size) < maxW) {
                    charLine += char;
                } else {
                    lines.push(charLine);
                    charLine = char;
                }
            }
            currentLine = charLine;
        } else {
            const testLine = currentLine ? currentLine + " " + segment : segment;
            if (font.widthOfTextAtSize(testLine, size) < maxW) {
                currentLine = testLine;
            } else {
                lines.push(currentLine.trim());
                currentLine = segment;
            }
        }
    }

    if (currentLine) lines.push(currentLine.trim());
    return lines.length > 0 ? lines : [""];
}
