import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument, rgb, PDFFont, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { calculateAgeDetail } from "@/utils/probationCalculations";

export const runtime = "nodejs";

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}

function drawVectorCheckmark(page: any, x: any, y: any, size: number, color: any) {
    page.drawLine({
        start: { x: x, y: y + size * 0.4 },
        end: { x: x + size * 0.35, y: y },
        thickness: size * 0.15,
        color: color
    });
    page.drawLine({
        start: { x: x + size * 0.35, y: y },
        end: { x: x + size * 0.9, y: y + size * 0.8 },
        thickness: size * 0.15,
        color: color
    });
}

const CATEGORY_NAMES = [
    "1.   คุณภาพงาน",
    "2.   ปริมาณงาน",
    "3.   ความตั้งใจ / ความขยัน / ความทุ่มเท",
    "4.   ความรอบรู้ / ความเข้าใจในงาน",
    "5.   การเรียนรู้ / การพัฒนาตนเอง / การปรับตัว",
    "6.   การเชื่อฟังคำแนะนำ / คำสั่งของผู้บังคับบัญชา",
    "7.   ความรับผิดชอบในงาน / ความเชื่อถือ / ความไว้วางใจได้",
    "8.   ความคิดริเริ่มสร้างสรรค์ / การเสนอข้อคิดเห็นที่เป็นประโยชน์",
    "9.   สัมพันธภาพในการทำงาน / ความมีมนุษยสัมพันธ์",
    "10.  การรักษาระเบียบวินัย / ข้อบังคับของบริษัท",
    "11.  การใช้ / การดูแล / การจัดเก็บ / การบำรุงรักษาอุปกรณ์",
    "12.  เข้าร่วมกิจกรรมของบริษัท"
];
const WEIGHTS = [4, 3, 8, 5, 5, 4, 8, 6, 3, 3, 3, 5];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAdmin();
        const { id: idStr } = await params;
        const id = parseInt(idStr);

        const evalData = await prisma.probation_evaluations.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        name: true,
                        emp_id: true,
                        hire_date: true,
                        birth_date: true,
                        job_positions: { select: { title: true } },
                        departments: { select: { name: true } }
                    }
                },
                supervisor: { select: { name: true } }
            }
        });

        if (!evalData) return NextResponse.json({ error: "EVALUATION_NOT_FOUND" }, { status: 404 });

        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const fontRegularBytes = await loadFontBytes("public/fonts/Sarabun-Regular.ttf");
        const fontBoldBytes = await loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null);
        const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: true });
        const fontBold = fontBoldBytes ? await pdf.embedFont(fontBoldBytes, { subset: true }) : fontRegular;
        const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

        const page = pdf.addPage([595.28, 841.89]); // Forced A4
        const { width, height } = page.getSize();

        // Standard Monochrome Palette
        const BLACK = rgb(0, 0, 0);
        const WHITE = rgb(1, 1, 1);

        // Strict Margin Calibration
        const ML = 36; 
        const MR = width - 36;
        const FULL_W = MR - ML;
        let y = height - 16; // Top Margin

        // --- 1. Header (Double Border) ---
        const TITLE_H = 42; // Compacted from 46
        const INFO_H = 16;  // Compacted from 18
        const HEADER_TOT_H = TITLE_H + INFO_H;

        page.drawRectangle({ x: ML, y: y - HEADER_TOT_H, width: FULL_W, height: HEADER_TOT_H, borderColor: BLACK, borderWidth: 1.1 });
        page.drawRectangle({ x: ML + 2, y: y - HEADER_TOT_H + 2, width: FULL_W - 4, height: HEADER_TOT_H - 4, borderColor: BLACK, borderWidth: 0.3 });

        const titleText = "แบบฟอร์มประเมินผลการปฏิบัติงานระยะทดลองงาน";
        const titleW = fontBold.widthOfTextAtSize(titleText, 12);
        page.drawText(titleText, { x: ML + (FULL_W - titleW) / 2, y: y - 22, size: 12, font: fontBold, color: BLACK });

        const subText = "PROBATION PERFORMANCE EVALUATION FORM";
        const subW = fontItalic.widthOfTextAtSize(subText, 7);
        page.drawText(subText, { x: ML + (FULL_W - subW) / 2, y: y - 35, size: 7, font: fontItalic, color: BLACK });

        // --- Logo Embed ---
        try {
            const logoPath = path.join(process.cwd(), "src/app/icon.jpg");
            const logoBytes = await fs.readFile(logoPath);
            const logoImage = await pdf.embedJpg(logoBytes);
            page.drawImage(logoImage, {
                x: ML + 6,
                y: y - 38,
                width: 31,
                height: 31
            });
        } catch (e) {
            console.warn("[PDF/LOGO] Failed to load logo:", e);
        }

        const infoY = y - TITLE_H;
        page.drawLine({ start: { x: ML, y: infoY }, end: { x: MR, y: infoY }, thickness: 0.5, color: BLACK });
        page.drawText("เอกสารเลขที่ :  TEP-HR-F-003", { x: ML + 8, y: infoY - 11, size: 7, font: fontRegular, color: BLACK });
        page.drawLine({ start: { x: ML + FULL_W / 2, y: infoY }, end: { x: ML + FULL_W / 2, y: infoY - INFO_H }, thickness: 0.4, color: BLACK });
        page.drawText("แก้ไขครั้งที่ :  00     วันที่บังคับใช้ :  04/01/68", { x: ML + FULL_W / 2 + 8, y: infoY - 11, size: 7, font: fontRegular, color: BLACK });

        y -= HEADER_TOT_H + 8;

        // --- 2. Metadata Grid (Vertical Compaction) ---
        const ROW_H = 16; // Compacted from 18
        const COL_A = 210;
        const COL_B = 175;
        const COL_C = FULL_W - COL_A - COL_B;
        const XA = ML; const XB = ML + COL_A; const XC = ML + COL_A + COL_B;

        const formatDate = (d: Date | null) => d ? d.toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' }) : "-";
        
        const metaRows = [
            [
                { label: "ประเมินตั้งแต่", value: formatDate(evalData.period_start), x: XA, w: COL_A },
                { label: "ถึง", value: formatDate(evalData.period_end), x: XB, w: COL_B },
                { label: "ครั้งที่", value: evalData.evaluation_no.toString(), x: XC, w: COL_C }
            ],
            [
                { label: "ชื่อ - สกุล", value: evalData.employee.name, x: XA, w: COL_A },
                { label: "ตำแหน่ง", value: evalData.employee.job_positions?.title || "-", x: XB, w: COL_B + COL_C }
            ],
            [
                { label: "สังกัด / ฝ่าย", value: evalData.employee.departments?.name || "-", x: XA, w: COL_A },
                { label: "รหัสพนักงาน", value: evalData.employee.emp_id, x: XB, w: COL_B + COL_C }
            ],
            [
                { label: "วันที่เริ่มงาน", value: formatDate(evalData.employee.hire_date), x: XA, w: COL_A },
                { label: "อายุ", value: calculateAgeDetail(evalData.employee.birth_date, evalData.evaluation_date), x: XB, w: COL_B + COL_C } 
            ]
        ];

        const metaStart = y;
        metaRows.forEach((row, i) => {
            row.forEach(cell => {
                page.drawText(cell.label, { x: cell.x + 8, y: y - 11, size: 7.5, font: fontRegular, color: BLACK });
                const labelW = fontRegular.widthOfTextAtSize(cell.label, 7.5);
                page.drawText(cell.value, { x: cell.x + 8 + labelW + 6, y: y - 11, size: 8, font: fontBold, color: BLACK });
            });
            page.drawLine({ start: { x: ML, y: y - ROW_H }, end: { x: MR, y: y - ROW_H }, thickness: 0.4, color: BLACK });
            page.drawLine({ start: { x: XB, y: y }, end: { x: XB, y: y - ROW_H }, thickness: 0.4, color: BLACK });
            if (i === 0) page.drawLine({ start: { x: XC, y: y }, end: { x: XC, y: y - ROW_H }, thickness: 0.4, color: BLACK });
            y -= ROW_H;
        });
        page.drawRectangle({ x: ML, y: y, width: FULL_W, height: metaStart - y, borderColor: BLACK, borderWidth: 0.8 });

        y -= 6;
        const legendText = "ระดับเกณฑ์การให้คะแนน :    5 = ดีมาก    4 = ดี    3 = พอใช้    2 = ต้องปรับปรุง    1 = ไม่ผ่านเกณฑ์";
        const legendCenter = ML + (FULL_W - fontRegular.widthOfTextAtSize(legendText, 7.5)) / 2;
        page.drawText(legendText, { x: legendCenter, y: y - 8, size: 7.5, font: fontRegular, color: BLACK });

        y -= 12;
        page.drawLine({ start: { x: ML, y: y }, end: { x: MR, y: y }, thickness: 0.4, color: BLACK });
        y -= 6;

        // --- 3. Scoring Matrix (Precision Width & Row heights) ---
        const CAT_W = 212;
        const CW = [CAT_W, 21, 21, 21, 21, 21, 34, 46, FULL_W - CAT_W - 21 * 5 - 34 - 46];
        const CX = [ML];
        for (let w of CW) CX.push(CX[CX.length - 1] + w);

        const HDR_H = 30; // Compacted from 32
        const matrixTop = y;

        const hdrLabels = [
            ["หัวข้อพิจารณา"], ["5"], ["4"], ["3"], ["2"], ["1"],
            ["น.น", "ความสำคัญ"],
            ["คะแนน", "ที่ได้ (×น.น)"],
            ["ความคิดเห็น"],
        ];

        hdrLabels.forEach((lines, i) => {
            const centerX = CX[i] + CW[i] / 2;
            const startY = y - (HDR_H - lines.length * 8) / 2 - 8 + 1;
            lines.forEach((line, j) => {
                const tw = fontBold.widthOfTextAtSize(line, 7);
                page.drawText(line, { x: centerX - tw / 2, y: startY - j * 8, size: 7, font: fontBold, color: BLACK });
            });
            if (i > 0) page.drawLine({ start: { x: CX[i], y: y }, end: { x: CX[i], y: y - HDR_H }, thickness: 0.5, color: BLACK });
        });
        page.drawLine({ start: { x: ML, y: y - HDR_H }, end: { x: MR, y: y - HDR_H }, thickness: 1.0, color: BLACK });
        y -= HDR_H;

        const scores = [
            evalData.score_work_quality, evalData.score_work_quantity, evalData.score_dedication,
            evalData.score_knowledge, evalData.score_learning, evalData.score_obedience,
            evalData.score_responsibility, evalData.score_creativity, evalData.score_teamwork,
            evalData.score_discipline, evalData.score_tool_maintenance, evalData.score_participation
        ];

        for (let i = 0; i < CATEGORY_NAMES.length; i++) {
            const rowH = 15; // Vertical Compaction
            const textX = CX[0] + 6;
            const maxW = CW[0] - 12;
            
            // Wrapping Check
            const chars = CATEGORY_NAMES[i].split("");
            let line1 = ""; let line2 = "";
            let overflow = false;
            for (const char of chars) {
                if (!overflow && fontRegular.widthOfTextAtSize(line1 + char, 7.2) < maxW) {
                    line1 += char;
                } else {
                    overflow = true;
                    line2 += char;
                }
            }

            if (line2) {
                page.drawText(line1, { x: textX, y: y - 7.5, size: 7.2, font: fontRegular, color: BLACK });
                page.drawText(line2, { x: textX, y: y - 13.5, size: 7.2, font: fontRegular, color: BLACK });
            } else {
                page.drawText(CATEGORY_NAMES[i], { x: textX, y: y - 10.5, size: 7.5, font: fontRegular, color: BLACK });
            }

            const currentScore = scores[i] || 0;
            const scoreVals = [5, 4, 3, 2, 1];
            for (let sIdx = 0; sIdx < 5; sIdx++) {
                const x0 = CX[sIdx + 1]; const w0 = CW[sIdx + 1];
                if (currentScore === scoreVals[sIdx]) {
                    const checkSize = 6;
                    drawVectorCheckmark(page, x0 + w0 / 2 - checkSize / 2, y - rowH / 2 - checkSize / 2, checkSize, BLACK);
                }
                page.drawLine({ start: { x: x0, y: y }, end: { x: x0, y: y - rowH }, thickness: 0.35, color: BLACK });
            }

            const x6 = CX[6]; const w6 = CW[6];
            page.drawLine({ start: { x: x6, y: y }, end: { x: x6, y: y - rowH }, thickness: 0.35, color: BLACK });
            page.drawText(WEIGHTS[i].toString(), { x: x6 + (w6 - fontRegular.widthOfTextAtSize(WEIGHTS[i].toString(), 7.5)) / 2, y: y - 10.5, size: 7.5, font: fontRegular, color: BLACK });

            const x7 = CX[7]; const w7 = CW[7];
            page.drawLine({ start: { x: x7, y: y }, end: { x: x7, y: y - rowH }, thickness: 0.35, color: BLACK });
            const earned = (currentScore * WEIGHTS[i]).toString();
            page.drawText(earned, { x: x7 + (w7 - fontBold.widthOfTextAtSize(earned, 8)) / 2, y: y - 10.5, size: 8, font: fontBold, color: BLACK });

            page.drawLine({ start: { x: CX[8], y: y }, end: { x: CX[8], y: y - rowH }, thickness: 0.35, color: BLACK });
            page.drawLine({ start: { x: ML, y: y - rowH }, end: { x: MR, y: y - rowH }, thickness: 0.35, color: BLACK });
            y -= rowH;
        }
        page.drawRectangle({ x: ML, y: y, width: FULL_W, height: matrixTop - y, borderColor: BLACK, borderWidth: 0.8 });

        // --- 4. Attendance Rows (Vertical Compaction) ---
        const attTop = y;
        const attendance = [
            { label: "13. มาสาย", count: evalData.count_late, u: "ครั้ง", score: evalData.score_late, ths: ['0', '1-2', '3-5', '6-10', '>11'] },
            { label: "14. ลาป่วย", count: evalData.count_sick_leave, u: "วัน", score: evalData.score_sick_leave, ths: ['0', '1', '2', '3-4', '>5'] },
            { label: "15. ลากิจ",  count: evalData.count_personal_leave, u: "วัน", score: evalData.score_personal_leave, ths: ['0', '1', '2', '3-4', '>5'] },
        ];

        for (const item of attendance) {
            const rowH = 20; // Compacted from 24
            page.drawText(item.label, { x: CX[0] + 6, y: y - 8, size: 7.2, font: fontRegular, color: BLACK });
            page.drawText(`${item.count} ${item.u}`, { x: CX[0] + 6, y: y - 16, size: 7.5, font: fontBold, color: BLACK });

            for (let sIdx = 0; sIdx < 5; sIdx++) {
                const x0 = CX[sIdx + 1]; const w0 = CW[sIdx + 1];
                page.drawLine({ start: { x: x0, y: y }, end: { x: x0, y: y - rowH }, thickness: 0.35, color: BLACK });
                page.drawText(item.ths[sIdx], { x: x0 + (w0 - fontRegular.widthOfTextAtSize(item.ths[sIdx], 5.5)) / 2, y: y - 7, size: 5.5, font: fontRegular, color: BLACK });
                if (item.score === (5 - sIdx)) {
                    const checkSize = 6;
                    drawVectorCheckmark(page, x0 + w0 / 2 - checkSize / 2, y - 15 - checkSize/2, checkSize, BLACK);
                }
            }
            page.drawLine({ start: { x: CX[6], y: y }, end: { x: CX[6], y: y - rowH }, thickness: 0.35, color: BLACK });
            page.drawText("1", { x: CX[6] + (CW[6] - fontRegular.widthOfTextAtSize("1", 7.5)) / 2, y: y - 11, size: 7.5, font: fontRegular, color: BLACK });
            page.drawLine({ start: { x: CX[7], y: y }, end: { x: CX[7], y: y - rowH }, thickness: 0.35, color: BLACK });
            page.drawText(item.score.toString(), { x: CX[7] + (CW[7] - fontBold.widthOfTextAtSize(item.score.toString(), 8)) / 2, y: y - 11, size: 8, font: fontBold, color: BLACK });
            page.drawLine({ start: { x: CX[8], y: y }, end: { x: CX[8], y: y - rowH }, thickness: 0.35, color: BLACK });
            page.drawLine({ start: { x: ML, y: y - rowH }, end: { x: MR, y: y - rowH }, thickness: 0.35, color: BLACK });
            y -= rowH;
        }
        page.drawRectangle({ x: ML, y: y, width: FULL_W, height: attTop - y, borderColor: BLACK, borderWidth: 0.8 });

        // --- 5. Total Bar ---
        page.drawRectangle({ x: ML, y: y - 16, width: FULL_W, height: 16, borderColor: BLACK, borderWidth: 0.8 });
        const summaryT = `คะแนนเต็ม  300  คะแนน          รวมทั้งหมดได้  ${evalData.total_score}  คะแนน          เกรด  ${evalData.grade || "-"}`;
        const summaryW = fontBold.widthOfTextAtSize(summaryT, 8.5);
        page.drawText(summaryT, { x: ML + (FULL_W - summaryW) / 2, y: y - 11.5, size: 8.5, font: fontBold, color: BLACK });
        y -= 19;

        const gradeLeg = "A=300–280  B=279–260  C=259–240  D=239–220  E=<220    (หมายเหตุ: ต้องได้คะแนนไม่ต่ำกว่าเกรด C จึงจะผ่านการประเมิน)";
        const glC = ML + (FULL_W - fontRegular.widthOfTextAtSize(gradeLeg, 6.5)) / 2;
        page.drawText(gradeLeg, { x: glC, y: y - 8, size: 6.5, font: fontRegular, color: BLACK });
        page.drawLine({ start: { x: ML, y: y - 11 }, end: { x: MR, y: y - 11 }, thickness: 0.4, color: BLACK });
        y -= 15;

        // --- 6. Comments (Max Vertical Compaction) ---
        const drawSectionHeader = (label: string, curY: number) => {
            page.drawText(label, { x: ML, y: curY - 10, size: 8.5, font: fontBold, color: BLACK });
            page.drawLine({ start: { x: ML, y: curY - 12 }, end: { x: MR, y: curY - 12 }, thickness: 0.7, color: BLACK });
            return curY - 13;
        };

        const drawCBox = (label: string, val: string, boxH: number) => {
            y = drawSectionHeader(label, y);
            page.drawRectangle({ x: ML, y: y - boxH, width: FULL_W, height: boxH, borderColor: BLACK, borderWidth: 0.5 });
            if (val) page.drawText(val, { x: ML + 6, y: y - 14, size: 8, font: fontRegular, color: BLACK });
            y -= boxH + 6;
        };

        drawCBox("ความคิดเห็นเพิ่มเติมของผู้ประเมิน", evalData.comment_supervisor || "", 22);
        drawCBox("คำแนะนำในการแก้ไขปัญหา", evalData.comment_improvement || "", 22);
        drawCBox("คำชื่นชม", evalData.comment_praise || "", 18);

        // --- 7. Decision ---
        y = drawSectionHeader("สรุปผลการประเมิน", y);
        y -= 10; // Increased padding to prevent overlap
        const COL_QX = FULL_W / 4;
        const opts = [
            { key: "fail", l: "ไม่ผ่านทดลองงาน", i: 0 },
            { key: "pass", l: "ผ่านทดลองงาน", i: 1 },
            { key: "extend", l: "ต่อทดลองงาน", i: 2 },
            { key: "salary_adjust", l: "เสนอปรับเงินเดือน", i: 3 }
        ];

        opts.forEach(opt => {
            const dx = ML + opt.i * COL_QX + 4;
            const isChecked = evalData.decision === opt.key;
            page.drawRectangle({ x: dx, y: y - 8, width: 8, height: 8, color: isChecked ? BLACK : WHITE, borderColor: BLACK, borderWidth: 0.7 });
            if (isChecked) {
                const checkSize = 5;
                drawVectorCheckmark(page, dx + 1, y - 6.5, checkSize, WHITE);
            }
            page.drawText(opt.l, { x: dx + 11, y: y - 7, size: 7.5, font: fontRegular, color: BLACK });
        });

        y -= 18; 
        const salaryX = ML + 2.4 * COL_QX;
        page.drawText("จาก", { x: salaryX, y: y - 2, size: 7, font: fontRegular, color: BLACK });
        page.drawLine({ start: { x: salaryX + 14, y: y - 3 }, end: { x: salaryX + 60, y: y - 3 }, thickness: 0.6, color: BLACK });
        if (evalData.salary_adjust_from) {
            page.drawText(evalData.salary_adjust_from.toLocaleString(), { x: salaryX + 16, y: y - 2, size: 7, font: fontBold });
        }
        page.drawText("บาท เป็น", { x: salaryX + 62, y: y - 2, size: 7, font: fontRegular, color: BLACK });
        page.drawLine({ start: { x: salaryX + 100, y: y - 3 }, end: { x: salaryX + 145, y: y - 3 }, thickness: 0.6, color: BLACK });
        if (evalData.salary_adjust_to) {
            page.drawText(evalData.salary_adjust_to.toLocaleString(), { x: salaryX + 102, y: y - 2, size: 7, font: fontBold });
        }
        page.drawText("บาท", { x: salaryX + 147, y: y - 2, size: 7, font: fontRegular, color: BLACK });

        y -= 14;
        page.drawLine({ start: { x: ML, y: y }, end: { x: MR, y: y }, thickness: 0.4, color: BLACK });
        y -= 8;

        // --- 8. Signatures (Precise A4 Frame) ---
        page.drawText("ลายมือชื่อผู้เกี่ยวข้อง", { x: ML, y: y - 10, size: 8.5, font: fontBold, color: BLACK });
        y -= 12;
        const SIG_H = 64; // Compacted from 72
        const SIG_GAP = 12;
        const SIG_W = (FULL_W - SIG_GAP * 2) / 3;
        const sigRoles = [
            { name: evalData.employee.name, role: "พนักงาน (ผู้รับการประเมิน)" },
            { name: evalData.supervisor.name, role: "ผู้ประเมิน" },
            { name: "นางสาวปาริชาติ สาคร", role: "ฝ่ายทรัพยากรบุคคล" }
        ];

        sigRoles.forEach((p, i) => {
            const sx = ML + i * (SIG_W + SIG_GAP);
            page.drawRectangle({ x: sx, y: y - SIG_H, width: SIG_W, height: SIG_H, borderColor: BLACK, borderWidth: 0.7 });
            const rW = fontBold.widthOfTextAtSize(p.role, 7.5);
            page.drawText(p.role, { x: sx + (SIG_W - rW) / 2, y: y - 10.5, size: 7.5, font: fontBold, color: BLACK });
            page.drawLine({ start: { x: sx + 14, y: y - 32 }, end: { x: sx + SIG_W - 14, y: y - 32 }, thickness: 0.5, color: BLACK, dashArray: [1, 2] });
            const nW = fontRegular.widthOfTextAtSize(`( ${p.name} )`, 7.5);
            page.drawText(`( ${p.name} )`, { x: sx + (SIG_W - nW) / 2, y: y - 44, size: 7.5, font: fontRegular, color: BLACK });
            page.drawLine({ start: { x: sx + 14, y: y - 56 }, end: { x: sx + SIG_W - 14, y: y - 56 }, thickness: 0.5, color: BLACK });
            const dTW = fontRegular.widthOfTextAtSize("วันที่ ......... / ......... / .........", 6.5);
            page.drawText("วันที่ ......... / ......... / .........", { x: sx + (SIG_W - dTW) / 2, y: y - 53, size: 6.5, font: fontRegular, color: BLACK });
        });

        const bytes = await pdf.save();
        return new Response(Buffer.from(bytes), {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="eval_${evalData.employee.emp_id}.pdf"` },
        });
    } catch (e: any) {
        console.error("[API/PROBATION/PDF] Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
}
