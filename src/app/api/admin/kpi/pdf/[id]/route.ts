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

        let page = pdf.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();

        // Colors
        const PRIMARY_RED = rgb(1, 0, 0); // Pure Red for the bar
        const BLACK = rgb(0, 0, 0);
        const GRAY_BG = rgb(0.95, 0.95, 0.95);
        const GRAY_BORDER = rgb(0.8, 0.8, 0.8);
        const GRAY_TEXT = rgb(0.4, 0.4, 0.4);

        const ML = 40; 
        const MR = width - 40;
        const FULL_W = MR - ML;
        let y = height - 40;

        // --- 1. Formal Header Layout ---
        // Top Title
        const title = "แบบประเมินผลการปฏิบัติงาน";
        const titleW = fontBold.widthOfTextAtSize(title, 12);
        page.drawText(title, { x: (width - titleW) / 2, y: y, size: 12, font: fontBold });
        y -= 25;

        const drawField = (label: string, value: string, x: number, currentY: number, w: number) => {
            page.drawText(label, { x, y: currentY, size: 9, font: fontRegular });
            const labelW = fontRegular.widthOfTextAtSize(label, 9);
            const valX = x + labelW + 5;
            page.drawText(value || "-", { x: valX, y: currentY, size: 9, font: fontBold });
            // Draw underline
            page.drawLine({
                start: { x: valX, y: currentY - 2 },
                end: { x: x + w, y: currentY - 2 },
                thickness: 0.5,
                color: GRAY_BORDER
            });
        };

        const col1 = ML;
        const col2 = ML + (FULL_W * 0.45);
        const fieldW = FULL_W * 0.4;

        drawField("ชื่อ-สกุล", evalData.employee.name, col1, y, fieldW);
        drawField("รหัสพนักงาน", evalData.employee.emp_id, col2, y, fieldW);
        y -= 20;

        drawField("ตำแหน่ง", evalData.employee.job_positions?.title || "-", col1, y, fieldW);
        drawField("แผนก/ฝ่าย", evalData.employee.departments?.name || "-", col2, y, fieldW);
        y -= 20;

        drawField("บริษัท", "เทอรา กรุ๊ป จำกัด", col1, y, fieldW);
        drawField("วันที่เริ่มงาน", formatThaiDate(evalData.employee.hire_date), col2, y, fieldW);
        y -= 20;

        drawField("อายุงาน (สะสม)", calculateWorkAge(evalData.employee.hire_date), col1, y, fieldW);
        drawField("ชื่อผู้บังคับบัญชา", evalData.employee.supervisor?.name || evalData.supervisor.name, col2, y, fieldW);
        y -= 20;

        drawField("ระยะเวลาการประเมิน", `${formatThaiDate(evalData.period_start)} - ${formatThaiDate(evalData.period_end)}`, col1, y, fieldW);
        drawField("ครั้งที่", evalData.evaluation_no.toString(), col2, y, fieldW);
        y -= 35;

        // --- 2. Red Section Bar ---
        page.drawRectangle({ x: ML, y: y - 18, width: FULL_W, height: 18, color: PRIMARY_RED });
        page.drawText("ส่วนที่ 1 เป้าหมายการปฏิบัติงาน (Performance Objectives)", { x: ML + 10, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
        y -= 35;

        // Instructions
        const instructions = [
            "- กำหนดเป้าหมาย KPI สำหรับงานที่เป็นงานประจำ (BAU - Business-As-Usual)",
            "- กำหนด OKR สำหรับงานที่เป็นงานปรับปรุงพัฒนา งานริเริ่มสร้างสรรค์ งานโครงการพิเศษ (Improvements/ Initiatives/ Special Projects)",
            "เกณฑ์การให้คะแนนประเมิน",
            "1   บรรลุผลสำเร็จน้อยมากหรือไม่อยู่เลยเมื่อเทียบกับเป้าหมาย",
            "2   บรรลุผลสำเร็จบางส่วนเมื่อเทียบกับเป้าหมาย",
            "3   บรรลุผลสำเร็จตามเป้าหมายที่กำหนดไว้",
            "4   บรรลุผลสำเร็จมากกว่าเป้าหมายที่กำหนดไว้",
            "5   บรรลุผลสำเร็จเกินกว่าเป้าหมายที่กำหนดไว้อย่างมาก"
        ];

        instructions.forEach((line, i) => {
            const isBold = i === 2;
            page.drawText(line, { x: ML, y, size: 8, font: isBold ? fontBold : fontRegular });
            y -= 12;
        });
        y -= 10;

        // --- 3. Main KPI Table ---
        const CW = [110, 110, 45, 60, 45, 45, 45, 50]; // Objective, Indicator, Weight, Result, Emp-Score, Emp-Total, Sup-Score, Sup-Total
        const CX = [ML];
        CW.forEach((w, i) => CX.push(CX[i] + w));

        // Table Header
        const HDR1_H = 35;
        page.drawRectangle({ x: ML, y: y - HDR1_H, width: FULL_W, height: HDR1_H, color: rgb(0.9, 0.9, 0.9), borderColor: BLACK, borderWidth: 0.5 });
        
        const hdrLabels = [
            ["เป้าหมายการปฏิบัติงาน", "(Performance Objective)"],
            ["ตัวชี้วัด", "(Indicators)"],
            ["น้ำหนัก", "(%)"],
            ["ผลลัพธ์ของงาน", "(Actual Results)"],
            ["พนักงาน", "ประเมิน"],
            ["รวมคะแนน", "ประเมินดัวเอง"],
            ["หัวหน้างาน", "ประเมิน"],
            ["คะแนน", "ที่ได้"]
        ];

        hdrLabels.forEach((lines, i) => {
            lines.forEach((line, li) => {
                const tw = fontBold.widthOfTextAtSize(line, 7);
                page.drawText(line, { x: CX[i] + (CW[i] - tw) / 2, y: y - 13 - (li * 10), size: 7, font: fontBold });
            });
        });
        
        // Vertical dividers for header
        for(let i=1; i<CX.length-1; i++) {
            page.drawLine({ start: { x: CX[i], y: y }, end: { x: CX[i], y: y - HDR1_H }, thickness: 0.5, color: BLACK });
        }

        y -= HDR1_H;

        // Table Body
        let totalWeight = 0;
        let totalEmpWeighted = 0;
        let totalSupWeighted = 0;

        for (const item of evalData.items) {
            const wrapObj = wrapText(item.objective, CW[0] - 8, fontRegular, 7);
            const wrapInd = wrapText(item.indicator, CW[1] - 8, fontRegular, 7);
            const wrapRes = wrapText(item.result_description || "-", CW[3] - 8, fontRegular, 7);
            
            const targets = [item.target_1, item.target_2, item.target_3, item.target_4, item.target_5].filter(t => !!t);
            const rubricLines = targets.length > 0 ? targets.length + 2 : 0;
            const linesCount = Math.max(wrapObj.length, wrapInd.length + rubricLines, wrapRes.length, 3);
            const rowH = (linesCount * 9) + 12;

            if (y - rowH < 60) {
                page = pdf.addPage([595.28, 841.89]);
                y = height - 60;
                // Simplified header on new page
                page.drawRectangle({ x: ML, y: y - 20, width: FULL_W, height: 20, color: rgb(0.9, 0.9, 0.9), borderColor: BLACK, borderWidth: 0.5 });
                hdrLabels.forEach((lines, i) => {
                    const tw = fontBold.widthOfTextAtSize(lines[0], 7);
                    page.drawText(lines[0], { x: CX[i] + (CW[i] - tw) / 2, y: y - 12, size: 7, font: fontBold });
                });
                y -= 20;
            }

            page.drawRectangle({ x: ML, y: y - rowH, width: FULL_W, height: rowH, borderColor: BLACK, borderWidth: 0.5 });
            
            wrapObj.forEach((line, i) => page.drawText(line, { x: CX[0] + 4, y: y - 12 - (i * 9), size: 7, font: fontRegular }));
            wrapInd.forEach((line, i) => page.drawText(line, { x: CX[1] + 4, y: y - 12 - (i * 9), size: 7, font: fontRegular, color: GRAY_TEXT }));
            wrapRes.forEach((line, i) => page.drawText(line, { x: CX[3] + 4, y: y - 12 - (i * 9), size: 7, font: fontRegular }));

            // Scoring Rubric if exists
            const allTargets = [item.target_1, item.target_2, item.target_3, item.target_4, item.target_5];
            if (allTargets.some(t => t)) {
                let ty = y - (wrapInd.length * 9) - 15;
                page.drawText("เกณฑ์การให้คะแนน:", { x: CX[1] + 4, y: ty, size: 6, font: fontBold, color: GRAY_TEXT });
                ty -= 8;
                allTargets.forEach((t, i) => {
                    if (t) {
                        page.drawText(`${i+1}: ${t}`, { x: CX[1] + 8, y: ty, size: 6, font: fontRegular, color: GRAY_TEXT });
                        ty -= 7;
                    }
                });
            }

            const weightVal = Number(item.weight);
            const empScore = Number(item.employee_score || 0);
            const supScore = Number(item.supervisor_score || 0);
            const empWeighted = (weightVal / 100) * empScore;
            const supWeighted = (weightVal / 100) * supScore;

            const drawC = (txt: string, i: number, isBold = false) => {
                const tw = (isBold ? fontBold : fontRegular).widthOfTextAtSize(txt, 8);
                page.drawText(txt, { x: CX[i] + (CW[i] - tw) / 2, y: y - (rowH / 2) - 3, size: 8, font: isBold ? fontBold : fontRegular });
            };

            drawC(`${weightVal}%`, 2, true);
            drawC(empScore > 0 ? empScore.toString() : "-", 4);
            drawC(empWeighted > 0 ? empWeighted.toFixed(2) : "-", 5);
            drawC(supScore > 0 ? supScore.toString() : "-", 6, true);
            drawC(supWeighted > 0 ? supWeighted.toFixed(2) : "-", 7, true);

            totalWeight += weightVal;
            totalEmpWeighted += empWeighted;
            totalSupWeighted += supWeighted;

            for(let i=1; i<CX.length-1; i++) {
                page.drawLine({ start: { x: CX[i], y: y }, end: { x: CX[i], y: y - rowH }, thickness: 0.5, color: BLACK });
            }
            y -= rowH;
        }

        // Table Footer (Total)
        page.drawRectangle({ x: ML, y: y - 18, width: FULL_W, height: 18, color: BLACK, borderColor: BLACK, borderWidth: 0.5 });
        page.drawText("คะแนนรวมส่วนที่ 1", { x: CX[0] + 5, y: y - 12, size: 8, font: fontBold, color: rgb(1,1,1) });
        
        const drawFT = (txt: string, i: number) => {
            const tw = fontBold.widthOfTextAtSize(txt, 8);
            page.drawText(txt, { x: CX[i] + (CW[i] - tw) / 2, y: y - 12, size: 8, font: fontBold, color: rgb(1,1,1) });
        };
        drawFT(`${totalWeight}%`, 2);
        drawFT(totalEmpWeighted.toFixed(2), 5);
        drawFT(totalSupWeighted.toFixed(2), 7);
        y -= 35;

        // --- 4. Overall Evaluation Section ---
        page.drawRectangle({ x: ML, y: y - 18, width: FULL_W, height: 18, color: rgb(0.3, 0.3, 0.3) });
        page.drawText("สรุปผลการประเมินโดยรวม (Overall Evaluation)", { x: ML + 10, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
        y -= 25;

        // Summary Table
        const SW = [240, 60, 60, 60, 50, 45]; // Header, Emp, Sup, Weight, Emp-Tot, Sup-Tot
        const SX = [ML];
        SW.forEach((w, i) => SX.push(SX[i] + w));

        const drawSumRow = (labels: string[], values: string[], h: number, isHeader = false) => {
            if (isHeader) page.drawRectangle({ x: ML, y: y - h, width: FULL_W, height: h, color: rgb(0.9, 0.9, 0.9), borderColor: BLACK, borderWidth: 0.5 });
            else page.drawRectangle({ x: ML, y: y - h, width: FULL_W, height: h, borderColor: BLACK, borderWidth: 0.5 });
            
            labels.forEach((txt, i) => {
                const tw = fontBold.widthOfTextAtSize(txt, 7);
                page.drawText(txt, { x: SX[i] + (SW[i] - tw) / 2, y: y - (h/2) - (isHeader ? 2 : 2), size: 7, font: fontBold });
            });
            values.forEach((txt, i) => {
                const idx = labels.length + i;
                const tw = fontBold.widthOfTextAtSize(txt, 8);
                page.drawText(txt, { x: SX[idx] + (SW[idx] - tw) / 2, y: y - (h/2) - 3, size: 8, font: fontBold });
            });
            for(let i=1; i<SX.length-1; i++) {
                page.drawLine({ start: { x: SX[i], y: y }, end: { x: SX[i], y: y - h }, thickness: 0.5, color: BLACK });
            }
            y -= h;
        };

        drawSumRow(["หัวข้อ", "พนักงาน", "หัวหน้างาน", "น้ำหนัก X", "รวมพนักงาน", "รวม"], [], 25, true);
        drawSumRow([], ["ประเมินตัวเอง", "ประเมิน"], 0, false); // This is just labels correction
        y += 25; // backtrack to redraw labels correctly
        y -= 25;
        drawSumRow(["คะแนนรวมของผลการปฏิบัติงานส่วนที่ 1", totalEmpWeighted.toFixed(2), totalSupWeighted.toFixed(2), "100%", totalEmpWeighted.toFixed(2), totalSupWeighted.toFixed(2)], [], 20);

        y -= 10;
        // Grading Scale Note in red
        const gradeNote = "A = 4.50 - 5.00   B = 3.50 - 4.49   C = 2.50 - 3.49   D = 1.50 - 2.49   E < 1.49";
        page.drawText(gradeNote, { x: ML, y, size: 8, font: fontBold, color: PRIMARY_RED });
        
        // Grade Highlight
        const gradeBoxW = 100;
        page.drawRectangle({ x: MR - gradeBoxW, y: y - 5, width: gradeBoxW, height: 20, color: rgb(1, 1, 0), borderColor: BLACK, borderWidth: 0.5 });
        page.drawText(`เกรด: ${evalData.grade || "-"}`, { x: MR - gradeBoxW + 25, y: y + 2, size: 10, font: fontBold, color: BLACK });
        y -= 30;

        // --- 5. Employee Comments Section ---
        const commentTitle = "ความคิดเห็นของพนักงาน (เลือกได้ข้อเดียว)";
        page.drawText(commentTitle, { x: ML, y, size: 9, font: fontBold });
        y -= 20;

        const drawCheckbox = (label: string, x: number, currentY: number, checked = false) => {
            page.drawRectangle({ x, y: currentY - 2, width: 10, height: 10, borderColor: BLACK, borderWidth: 1 });
            if (checked) {
                page.drawLine({ start: { x: x + 2, y: currentY + 3 }, end: { x: x + 8, y: currentY - 1 }, thickness: 1 });
                page.drawLine({ start: { x: x + 2, y: currentY - 1 }, end: { x: x + 8, y: currentY + 3 }, thickness: 1 });
            }
            page.drawText(label, { x: x + 15, y: currentY - 1, size: 9, font: fontRegular });
        };

        drawCheckbox("เห็นด้วย", ML + 20, y, true); // Mocked as true for layout
        drawCheckbox("ไม่เห็นด้วย", ML + 120, y, false);
        y -= 15;

        // Comment Box
        page.drawRectangle({ x: ML, y: y - 40, width: FULL_W, height: 40, borderColor: BLACK, borderWidth: 0.5 });
        if (evalData.employee_comment) {
            const wrapComm = wrapText(evalData.employee_comment, FULL_W - 10, fontRegular, 8);
            wrapComm.forEach((line, i) => {
                if (i < 4) page.drawText(line, { x: ML + 5, y: y - 12 - (i * 10), size: 8, font: fontRegular });
            });
        }
        y -= 65;

        // --- 6. Signatures ---
        const sigLineW = 140;
        const sigY = y;
        
        const drawSig = (label: string, x: number) => {
            page.drawText("ลงชื่อ", { x: x - 30, y: sigY, size: 9, font: fontRegular });
            page.drawLine({ start: { x, y: sigY - 2 }, end: { x: x + sigLineW, y: sigY - 2 }, thickness: 0.5, color: BLACK });
            page.drawText(label, { x: x + (sigLineW - fontRegular.widthOfTextAtSize(label, 8)) / 2, y: sigY - 14, size: 8, font: fontRegular, color: GRAY_TEXT });
            page.drawText("วันที่", { x: x - 30, y: sigY - 30, size: 9, font: fontRegular });
            page.drawLine({ start: { x, y: sigY - 32 }, end: { x: x + sigLineW, y: sigY - 32 }, thickness: 0.5, color: BLACK });
        };

        drawSig("พนักงาน", ML + 30);
        drawSig("ผู้ประเมินที่ 1", ML + 210);
        drawSig("ผู้ประเมินที่ 2", ML + 390);

        const bytes = await pdf.save();
        return new Response(Buffer.from(bytes), {
            headers: { 
                "Content-Type": "application/pdf", 
                "Content-Disposition": `inline; filename="KPI_Report_${evalData.employee.emp_id}.pdf"` 
            },
        });

    } catch (e: any) {
        console.error("[API/KPI/PDF] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

function wrapText(txt: string, maxW: number, font: any, size: number): string[] {
    const lines: string[] = [];
    let currentLine = "";
    const words = txt.split(" ");
    for (const word of words) {
        const testLine = currentLine + " " + word;
        if (font.widthOfTextAtSize(testLine, size) < maxW) {
            currentLine = testLine;
        } else {
            lines.push(currentLine.trim());
            currentLine = word;
        }
    }
    lines.push(currentLine.trim());
    return lines;
}
