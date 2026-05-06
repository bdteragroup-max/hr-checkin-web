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

function getThaiWrappedLines(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
    if (!text) return [];
    const lines: string[] = [];
    
    // Split by hard newlines to respect user formatting
    const hardLines = text.split("\n");
    
    for (const hardLine of hardLines) {
        if (!hardLine.trim()) {
            lines.push("");
            continue;
        }

        const segments = hardLine.split(" ");
        let currentLine = "";

        for (const segment of segments) {
            const testLine = currentLine ? currentLine + " " + segment : segment;
            const width = font.widthOfTextAtSize(testLine, fontSize);
            
            if (width < maxWidth) {
                currentLine = testLine;
            } else {
                if (font.widthOfTextAtSize(segment, fontSize) > maxWidth) {
                    if (currentLine) lines.push(currentLine);
                    
                    let subPart = "";
                    for (const char of segment) {
                        if (font.widthOfTextAtSize(subPart + char, fontSize) < maxWidth) {
                            subPart += char;
                        } else {
                            lines.push(subPart);
                            subPart = char;
                        }
                    }
                    currentLine = subPart;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = segment;
                }
            }
        }
        if (currentLine) lines.push(currentLine);
    }
    return lines;
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
                        departments: { select: { name: true } },
                        is_on_trial: true
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

        let currentPage = pdf.addPage([595.28, 841.89]); // Forced A4
        const { width, height } = currentPage.getSize();

        // Standard Monochrome Palette
        const BLACK = rgb(0, 0, 0);
        const WHITE = rgb(1, 1, 1);

        // Strict Margin Calibration
        const ML = 36; 
        const MR = width - 36;
        const FULL_W = MR - ML;
        let y = height - 16; // Top Margin

        const addNewPage = () => {
            currentPage = pdf.addPage([595.28, 841.89]);
            y = height - 36;
            return currentPage;
        };

        const ensureSpace = (needed: number) => {
            if (y - needed < 40) {
                addNewPage();
            }
        };

        // --- 1. Header (Double Border) ---
        const TITLE_H = 42; 
        const INFO_H = 16;  
        const HEADER_TOT_H = TITLE_H + INFO_H;

        currentPage.drawRectangle({ x: ML, y: y - HEADER_TOT_H, width: FULL_W, height: HEADER_TOT_H, borderColor: BLACK, borderWidth: 1.1 });
        currentPage.drawRectangle({ x: ML + 2, y: y - HEADER_TOT_H + 2, width: FULL_W - 4, height: HEADER_TOT_H - 4, borderColor: BLACK, borderWidth: 0.3 });

        const isTrial = evalData.employee.is_on_trial;
        const titleText = isTrial ? "แบบฟอร์มประเมินผลการปฏิบัติงานระยะทดลองงาน" : "แบบฟอร์มสรุปผลการปฏิบัติงานประจำเดือน";
        const titleW = fontBold.widthOfTextAtSize(titleText, 12);
        currentPage.drawText(titleText, { x: ML + (FULL_W - titleW) / 2, y: y - 22, size: 12, font: fontBold, color: BLACK });

        const subText = isTrial ? "PROBATION PERFORMANCE EVALUATION FORM" : "MONTHLY PERFORMANCE EVALUATION FORM";
        const subW = fontItalic.widthOfTextAtSize(subText, 7);
        currentPage.drawText(subText, { x: ML + (FULL_W - subW) / 2, y: y - 35, size: 7, font: fontItalic, color: BLACK });

        // --- Logo Embed ---
        try {
            const logoPath = path.join(process.cwd(), "src/app/icon.jpg");
            const logoBytes = await fs.readFile(logoPath);
            const logoImage = await pdf.embedJpg(logoBytes);
            currentPage.drawImage(logoImage, {
                x: ML + 6,
                y: y - 38,
                width: 31,
                height: 31
            });
        } catch (e) {
            console.warn("[PDF/LOGO] Failed to load logo:", e);
        }

        const infoY = y - TITLE_H;
        currentPage.drawLine({ start: { x: ML, y: infoY }, end: { x: MR, y: infoY }, thickness: 0.5, color: BLACK });
        currentPage.drawText("เอกสารเลขที่ :  TEP-HR-F-003", { x: ML + 8, y: infoY - 11, size: 7, font: fontRegular, color: BLACK });
        currentPage.drawLine({ start: { x: ML + FULL_W / 2, y: infoY }, end: { x: ML + FULL_W / 2, y: infoY - INFO_H }, thickness: 0.4, color: BLACK });
        currentPage.drawText("แก้ไขครั้งที่ :  00     วันที่บังคับใช้ :  04/01/68", { x: ML + FULL_W / 2 + 8, y: infoY - 11, size: 7, font: fontRegular, color: BLACK });

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
                currentPage.drawText(cell.label, { x: cell.x + 8, y: y - 11, size: 7.5, font: fontRegular, color: BLACK });
                const labelW = fontRegular.widthOfTextAtSize(cell.label, 7.5);
                currentPage.drawText(cell.value, { x: cell.x + 8 + labelW + 6, y: y - 11, size: 8, font: fontBold, color: BLACK });
            });
            currentPage.drawLine({ start: { x: ML, y: y - ROW_H }, end: { x: MR, y: y - ROW_H }, thickness: 0.4, color: BLACK });
            currentPage.drawLine({ start: { x: XB, y: y }, end: { x: XB, y: y - ROW_H }, thickness: 0.4, color: BLACK });
            if (i === 0) currentPage.drawLine({ start: { x: XC, y: y }, end: { x: XC, y: y - ROW_H }, thickness: 0.4, color: BLACK });
            y -= ROW_H;
        });
        currentPage.drawRectangle({ x: ML, y: y, width: FULL_W, height: metaStart - y, borderColor: BLACK, borderWidth: 0.8 });

        const legendText = "ระดับเกณฑ์การให้คะแนน :    5 = ดีมาก    4 = ดี    3 = พอใช้    2 = ต้องปรับปรุง    1 = ไม่ผ่านเกณฑ์";
        const legendCenter = ML + (FULL_W - fontRegular.widthOfTextAtSize(legendText, 7.5)) / 2;
        currentPage.drawText(legendText, { x: legendCenter, y: y - 8, size: 7.5, font: fontRegular, color: BLACK });
        
        // Side frames for legend section
        currentPage.drawLine({ start: { x: ML, y: y }, end: { x: ML, y: y - 12 }, thickness: 0.4, color: BLACK });
        currentPage.drawLine({ start: { x: MR, y: y }, end: { x: MR, y: y - 12 }, thickness: 0.4, color: BLACK });

        y -= 12;
        currentPage.drawLine({ start: { x: ML, y: y }, end: { x: MR, y: y }, thickness: 0.4, color: BLACK });
        // No extra y -= 6 here to keep lines connected

        // --- 3. Scoring Matrix (Precision Width & Row heights) ---
        // --- 3. Scoring Matrix (Balanced Column Widths) ---
        const CAT_W = FULL_W * 0.28;
        const S_W = FULL_W * 0.05;
        const W_W = FULL_W * 0.08;
        const SC_W = FULL_W * 0.08;
        const COM_W = FULL_W - CAT_W - (S_W * 5) - W_W - SC_W;
        
        const CW = [CAT_W, S_W, S_W, S_W, S_W, S_W, W_W, SC_W, COM_W];
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
                currentPage.drawText(line, { x: centerX - tw / 2, y: startY - j * 8, size: 7, font: fontBold, color: BLACK });
            });
            // Draw all vertical lines including outer boundaries
            currentPage.drawLine({ start: { x: CX[i], y: y }, end: { x: CX[i], y: y - HDR_H }, thickness: 0.5, color: BLACK });
        });
        // Draw the final vertical line on the far right
        currentPage.drawLine({ start: { x: MR, y: y }, end: { x: MR, y: y - HDR_H }, thickness: 0.5, color: BLACK });
        
        currentPage.drawLine({ start: { x: ML, y: y - HDR_H }, end: { x: MR, y: y - HDR_H }, thickness: 1.0, color: BLACK });
        y -= HDR_H;

        const scores = [
            evalData.score_work_quality, evalData.score_work_quantity, evalData.score_dedication,
            evalData.score_knowledge, evalData.score_learning, evalData.score_obedience,
            evalData.score_responsibility, evalData.score_creativity, evalData.score_teamwork,
            evalData.score_discipline, evalData.score_tool_maintenance, evalData.score_participation
        ];

        const scoreCommentKeys = [
            "work_quality", "work_quantity", "dedication",
            "knowledge", "learning", "obedience",
            "responsibility", "creativity", "teamwork",
            "discipline", "tool_maintenance", "participation"
        ];
        const scoreComments = (evalData as any).score_comments || {};

        for (let i = 0; i < CATEGORY_NAMES.length; i++) {
            const catComment = scoreComments[scoreCommentKeys[i]] || "";
            const catName = CATEGORY_NAMES[i];
            
            const nameLines = getThaiWrappedLines(catName, fontRegular, 7.2, CW[0] - 10);
            const commentLines = getThaiWrappedLines(catComment, fontRegular, 6.5, CW[8] - 8);
            
            const maxLines = Math.max(nameLines.length, commentLines.length, 1);
            const rowH = Math.max(15, maxLines * 10 + 4); 

            ensureSpace(rowH);

            // Left Outer Border
            currentPage.drawLine({ start: { x: ML, y: y }, end: { x: ML, y: y - rowH }, thickness: 0.35, color: BLACK });

            // Draw Category Name
            nameLines.forEach((line, lIdx) => {
                currentPage.drawText(line, { x: CX[0] + 5, y: y - 10 - (lIdx * 10), size: 7.2, font: fontRegular, color: BLACK });
            });

            const currentScore = scores[i] || 0;
            const scoreVals = [5, 4, 3, 2, 1];
            for (let sIdx = 0; sIdx < 5; sIdx++) {
                const x0 = CX[sIdx + 1]; const w0 = CW[sIdx + 1];
                if (currentScore === scoreVals[sIdx]) {
                    const checkSize = 6;
                    drawVectorCheckmark(currentPage, x0 + w0 / 2 - checkSize / 2, y - rowH / 2 - checkSize / 2, checkSize, BLACK);
                }
                currentPage.drawLine({ start: { x: x0, y: y }, end: { x: x0, y: y - rowH }, thickness: 0.35, color: BLACK });
            }

            // Weight
            const x6 = CX[6]; const w6 = CW[6];
            currentPage.drawLine({ start: { x: x6, y: y }, end: { x: x6, y: y - rowH }, thickness: 0.35, color: BLACK });
            currentPage.drawText(WEIGHTS[i].toString(), { x: x6 + (w6 - fontRegular.widthOfTextAtSize(WEIGHTS[i].toString(), 7.5)) / 2, y: y - rowH/2 - 3, size: 7.5, font: fontRegular, color: BLACK });

            // Score
            const x7 = CX[7]; const w7 = CW[7];
            currentPage.drawLine({ start: { x: x7, y: y }, end: { x: x7, y: y - rowH }, thickness: 0.35, color: BLACK });
            const earned = (currentScore * WEIGHTS[i]).toString();
            currentPage.drawText(earned, { x: x7 + (w7 - fontBold.widthOfTextAtSize(earned, 8)) / 2, y: y - rowH/2 - 3.5, size: 8, font: fontBold, color: BLACK });

            // Comment
            const x8 = CX[8];
            currentPage.drawLine({ start: { x: x8, y: y }, end: { x: x8, y: y - rowH }, thickness: 0.35, color: BLACK });
            commentLines.forEach((line, lIdx) => {
                currentPage.drawText(line, { x: x8 + 4, y: y - 10 - (lIdx * 10), size: 6.5, font: fontRegular, color: BLACK });
            });

            // Right Outer Border
            currentPage.drawLine({ start: { x: MR, y: y }, end: { x: MR, y: y - rowH }, thickness: 0.35, color: BLACK });

            currentPage.drawLine({ start: { x: ML, y: y - rowH }, end: { x: MR, y: y - rowH }, thickness: 0.35, color: BLACK });
            y -= rowH;
        }
        // Simplified matrix border for multi-page
        // page.drawRectangle({ x: ML, y: y, width: FULL_W, height: matrixTop - y, borderColor: BLACK, borderWidth: 0.8 });

        // --- 4. Attendance Rows (Vertical Compaction) ---
        const attTop = y;
        const attendance = [
            { label: "13. มาสาย", count: evalData.count_late, u: "ครั้ง", score: evalData.score_late, ths: ['0', '1-2', '3-5', '6-10', '>11'] },
            { label: "14. ลาป่วย", count: evalData.count_sick_leave, u: "วัน", score: evalData.score_sick_leave, ths: ['0', '1', '2', '3-4', '>5'] },
            { label: "15. ลากิจ",  count: evalData.count_personal_leave, u: "วัน", score: evalData.score_personal_leave, ths: ['0', '1', '2', '3-4', '>5'] },
        ];

        for (const item of attendance) {
            const rowH = 20; 
            ensureSpace(rowH);

            // Side Frames
            currentPage.drawLine({ start: { x: ML, y: y }, end: { x: ML, y: y - rowH }, thickness: 0.35, color: BLACK });
            currentPage.drawLine({ start: { x: MR, y: y }, end: { x: MR, y: y - rowH }, thickness: 0.35, color: BLACK });

            currentPage.drawText(item.label, { x: CX[0] + 6, y: y - 8, size: 7.2, font: fontRegular, color: BLACK });
            currentPage.drawText(`${item.count} ${item.u}`, { x: CX[0] + 6, y: y - 16, size: 7.5, font: fontBold, color: BLACK });

            for (let sIdx = 0; sIdx < 5; sIdx++) {
                const x0 = CX[sIdx + 1]; const w0 = CW[sIdx + 1];
                currentPage.drawLine({ start: { x: x0, y: y }, end: { x: x0, y: y - rowH }, thickness: 0.35, color: BLACK });
                currentPage.drawText(item.ths[sIdx], { x: x0 + (w0 - fontRegular.widthOfTextAtSize(item.ths[sIdx], 5.5)) / 2, y: y - 7, size: 5.5, font: fontRegular, color: BLACK });
                if (item.score === (5 - sIdx)) {
                    const checkSize = 6;
                    drawVectorCheckmark(currentPage, x0 + w0 / 2 - checkSize / 2, y - 15 - checkSize/2, checkSize, BLACK);
                }
            }
            currentPage.drawLine({ start: { x: CX[6], y: y }, end: { x: CX[6], y: y - rowH }, thickness: 0.35, color: BLACK });
            currentPage.drawText("1", { x: CX[6] + (CW[6] - fontRegular.widthOfTextAtSize("1", 7.5)) / 2, y: y - 11, size: 7.5, font: fontRegular, color: BLACK });
            currentPage.drawLine({ start: { x: CX[7], y: y }, end: { x: CX[7], y: y - rowH }, thickness: 0.35, color: BLACK });
            currentPage.drawText(item.score.toString(), { x: CX[7] + (CW[7] - fontBold.widthOfTextAtSize(item.score.toString(), 8)) / 2, y: y - 11, size: 8, font: fontBold, color: BLACK });
            currentPage.drawLine({ start: { x: CX[8], y: y }, end: { x: CX[8], y: y - rowH }, thickness: 0.35, color: BLACK });
            currentPage.drawLine({ start: { x: ML, y: y - rowH }, end: { x: MR, y: y - rowH }, thickness: 0.35, color: BLACK });
            y -= rowH;
        }
        currentPage.drawRectangle({ x: ML, y: y, width: FULL_W, height: attTop - y, borderColor: BLACK, borderWidth: 0.8 });

        // --- 5. Total Bar ---
        ensureSpace(20);
        currentPage.drawRectangle({ x: ML, y: y - 16, width: FULL_W, height: 16, borderColor: BLACK, borderWidth: 0.8 });
        const summaryT = `คะแนนเต็ม  300  คะแนน          รวมทั้งหมดได้  ${evalData.total_score}  คะแนน          เกรด  ${evalData.grade || "-"}`;
        const summaryW = fontBold.widthOfTextAtSize(summaryT, 8.5);
        currentPage.drawText(summaryT, { x: ML + (FULL_W - summaryW) / 2, y: y - 11.5, size: 8.5, font: fontBold, color: BLACK });
        y -= 19;

        const gradeLeg = "A=300–280  B=279–260  C=259–240  D=239–220  E=<220    (หมายเหตุ: ต้องได้คะแนนไม่ต่ำกว่าเกรด C จึงจะผ่านการประเมิน)";
        const glC = ML + (FULL_W - fontRegular.widthOfTextAtSize(gradeLeg, 6.5)) / 2;
        currentPage.drawText(gradeLeg, { x: glC, y: y - 8, size: 6.5, font: fontRegular, color: BLACK });
        currentPage.drawLine({ start: { x: ML, y: y - 11 }, end: { x: MR, y: y - 11 }, thickness: 0.4, color: BLACK });
        y -= 15;

        // --- 6. Comments (Max Vertical Compaction) ---
        const drawSectionHeader = (label: string, curY: number) => {
            ensureSpace(20);
            currentPage.drawText(label, { x: ML, y: y - 10, size: 8.5, font: fontBold, color: BLACK });
            currentPage.drawLine({ start: { x: ML, y: y - 12 }, end: { x: MR, y: y - 12 }, thickness: 0.7, color: BLACK });
            return y - 13;
        };

        const drawCBox = (label: string, val: string, minBoxH: number) => {
            const padding = 8;
            const fontSize = 8;
            const lineHeight = 12;
            const maxWidth = FULL_W - (padding * 2);
            const lines = getThaiWrappedLines(val, fontRegular, fontSize, maxWidth);
            const contentH = lines.length > 0 ? (lines.length * lineHeight) + (padding * 2) + 6 : minBoxH;
            const boxH = Math.max(minBoxH, contentH);

            ensureSpace(boxH + 20);
            y = drawSectionHeader(label, y);

            currentPage.drawRectangle({ x: ML, y: y - boxH, width: FULL_W, height: boxH, borderColor: BLACK, borderWidth: 0.5 });
            
            lines.forEach((line, i) => {
                if (!line) return;
                currentPage.drawText(line, { 
                    x: ML + padding, 
                    y: y - padding - (i * lineHeight) - fontSize, 
                    size: fontSize, 
                    font: fontRegular, 
                    color: BLACK 
                });
            });

            y -= boxH + 10;
        };

        drawCBox("ความคิดเห็นเพิ่มเติมของผู้ประเมิน", evalData.comment_supervisor || "", 24);
        drawCBox("คำแนะนำในการแก้ไขปัญหา", evalData.comment_improvement || "", 24);
        drawCBox("คำชื่นชม", evalData.comment_praise || "", 20);

        // --- 7. Decision ---
        y = drawSectionHeader("สรุปผลการประเมิน", y);
        y -= 6; 
        const COL_QX = FULL_W / 4;
        const opts = isTrial ? [
            { key: "fail", l: "ไม่ผ่านทดลองงาน", i: 0 },
            { key: "pass", l: "ผ่านทดลองงาน", i: 1 },
            { key: "extend", l: "ต่อทดลองงาน", i: 2 },
            { key: "salary_adjust", l: "เสนอปรับเงินเดือน", i: 3 }
        ] : [
            { key: "fail", l: "ไม่ผ่าน", i: 0 },
            { key: "pass", l: "ผ่าน", i: 1 }
        ];

        opts.forEach(opt => {
            const dx = ML + opt.i * (isTrial ? COL_QX : FULL_W / 2) + 4;
            const isChecked = evalData.decision === opt.key;
            currentPage.drawRectangle({ x: dx, y: y - 8, width: 8, height: 8, color: isChecked ? BLACK : WHITE, borderColor: BLACK, borderWidth: 0.7 });
            if (isChecked) {
                const checkSize = 5;
                drawVectorCheckmark(currentPage, dx + 1, y - 6.5, checkSize, WHITE);
            }
            currentPage.drawText(opt.l, { x: dx + 11, y: y - 7, size: 7.5, font: fontRegular, color: BLACK });
        });

        if (isTrial) {
            y -= 18; 
            const salaryX = ML + 2.4 * COL_QX;
            currentPage.drawText("จาก", { x: salaryX, y: y - 2, size: 7, font: fontRegular, color: BLACK });
            currentPage.drawLine({ start: { x: salaryX + 14, y: y - 3 }, end: { x: salaryX + 60, y: y - 3 }, thickness: 0.6, color: BLACK });
            if (evalData.salary_adjust_from) {
                currentPage.drawText(evalData.salary_adjust_from.toLocaleString(), { x: salaryX + 16, y: y - 2, size: 7, font: fontBold });
            }
            currentPage.drawText("บาท เป็น", { x: salaryX + 62, y: y - 2, size: 7, font: fontRegular, color: BLACK });
            currentPage.drawLine({ start: { x: salaryX + 100, y: y - 3 }, end: { x: salaryX + 145, y: y - 3 }, thickness: 0.6, color: BLACK });
            if (evalData.salary_adjust_to) {
                currentPage.drawText(evalData.salary_adjust_to.toLocaleString(), { x: salaryX + 102, y: y - 2, size: 7, font: fontBold });
            }
            currentPage.drawText("บาท", { x: salaryX + 147, y: y - 2, size: 7, font: fontRegular, color: BLACK });
        }

        y -= 14;
        currentPage.drawLine({ start: { x: ML, y: y }, end: { x: MR, y: y }, thickness: 0.4, color: BLACK });
        y -= 8;

        // --- 8. Signatures (Grouped on same page) ---
        const SIG_H = 64; 
        const SIG_GAP = 12;
        const SIG_W = (FULL_W - SIG_GAP * 2) / 3;
        const sigRoles = [
            { name: evalData.employee.name, role: "พนักงาน (ผู้รับการประเมิน)" },
            { name: evalData.supervisor.name, role: "ผู้ประเมิน" },
            { name: "นางสาวปาริชาติ สาคร", role: "ฝ่ายทรัพยากรบุคคล" }
        ];

        ensureSpace(SIG_H + 40);
        currentPage.drawText("ลายมือชื่อผู้เกี่ยวข้อง", { x: ML, y: y - 10, size: 8.5, font: fontBold, color: BLACK });
        y -= 12;

        sigRoles.forEach((p, i) => {
            const sx = ML + i * (SIG_W + SIG_GAP);
            currentPage.drawRectangle({ x: sx, y: y - SIG_H, width: SIG_W, height: SIG_H, borderColor: BLACK, borderWidth: 0.7 });
            const rW = fontBold.widthOfTextAtSize(p.role, 7.5);
            currentPage.drawText(p.role, { x: sx + (SIG_W - rW) / 2, y: y - 10.5, size: 7.5, font: fontBold, color: BLACK });
            currentPage.drawLine({ start: { x: sx + 14, y: y - 32 }, end: { x: sx + SIG_W - 14, y: y - 32 }, thickness: 0.5, color: BLACK, dashArray: [1, 2] });
            const nW = fontRegular.widthOfTextAtSize(`( ${p.name} )`, 7.5);
            currentPage.drawText(`( ${p.name} )`, { x: sx + (SIG_W - nW) / 2, y: y - 44, size: 7.5, font: fontRegular, color: BLACK });
            currentPage.drawLine({ start: { x: sx + 14, y: y - 56 }, end: { x: sx + SIG_W - 14, y: y - 56 }, thickness: 0.5, color: BLACK });
            const dTW = fontRegular.widthOfTextAtSize("วันที่ ......... / ......... / .........", 6.5);
            currentPage.drawText("วันที่ ......... / ......... / .........", { x: sx + (SIG_W - dTW) / 2, y: y - 53, size: 6.5, font: fontRegular, color: BLACK });
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
