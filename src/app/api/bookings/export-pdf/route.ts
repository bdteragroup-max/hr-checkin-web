import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { format } from "date-fns";

export const runtime = "nodejs";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COL_BLACK = rgb(0, 0, 0);
const COL_RED = rgb(0.78, 0.08, 0.08);
const COL_GREY = rgb(0.88, 0.88, 0.88);
const COL_WHITE = rgb(1, 1, 1);

// ─── Font loader ──────────────────────────────────────────────────────────────
async function loadFontBytes(relPath: string) {
    return fs.readFile(path.join(process.cwd(), relPath));
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

/** Draw a filled+bordered rectangle. y is the TOP edge. */
function drawRect(
    page: PDFPage,
    x: number, yTop: number,
    w: number, h: number,
    bg?: ReturnType<typeof rgb>
) {
    page.drawRectangle({
        x, y: yTop - h,
        width: w, height: h,
        ...(bg ? { color: bg } : {}),
        borderColor: COL_BLACK,
        borderWidth: 0.75,
    });
}

/** Draw text clipped to a cell. y is the TOP edge of the cell. */
function drawCell(
    page: PDFPage,
    text: string,
    cellX: number, yTop: number,
    cellW: number, cellH: number,
    font: PDFFont,
    size: number,
    color = COL_BLACK,
    align: "left" | "center" | "right" = "left",
    paddingX = 6,
    wrap = false
) {
    if (!text) return;

    const maxW = cellW - paddingX * 2;
    
    if (!wrap) {
        // Measure & truncate with ellipsis if needed
        let display = text;
        while (display.length > 1 && font.widthOfTextAtSize(display, size) > maxW) {
            display = display.slice(0, -1);
        }
        if (display !== text) display = display.slice(0, -1) + "…";

        const textW = font.widthOfTextAtSize(display, size);
        const baseline = yTop - cellH * 0.5 - size * 0.15;

        let textX: number;
        if (align === "center") textX = cellX + (cellW - textW) / 2;
        else if (align === "right") textX = cellX + cellW - textW - paddingX;
        else textX = cellX + paddingX;

        page.drawText(display, { x: textX, y: baseline, size, font, color });
    } else {
        // Simple wrapping logic
        const lines = wrapText(text, font, size, maxW);
        const lineHeight = size * 1.2;
        lines.forEach((line, i) => {
            const textW = font.widthOfTextAtSize(line, size);
            const baseline = yTop - (i + 1) * lineHeight;
            let textX = cellX + paddingX;
            if (align === "center") textX = cellX + (cellW - textW) / 2;
            page.drawText(line, { x: textX, y: baseline, size, font, color });
        });
    }
}

/** Simple text wrapper */
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split(/\r?\n/);
    
    for (const p of paragraphs) {
        if (!p) {
            lines.push("");
            continue;
        }
        let currentLine = "";
        const chars = Array.from(p); // Handle unicode/Thai characters correctly
        for (const char of chars) {
            const testLine = currentLine + char;
            if (font.widthOfTextAtSize(testLine, size) > maxW) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
    }
    return lines;
}

/** Draw a checkbox square and optionally fill it. */
function drawCheckbox(
    page: PDFPage,
    x: number, yCenter: number,
    size = 11,
    checked = false
) {
    page.drawRectangle({
        x, y: yCenter - size / 2,
        width: size, height: size,
        color: checked ? COL_BLACK : COL_WHITE,
        borderColor: COL_BLACK,
        borderWidth: 0.75,
    });
    if (checked) {
        // Draw a white checkmark using vector lines instead of text to avoid WinAnsi encoding errors
        page.drawLine({
            start: { x: x + 2, y: yCenter },
            end: { x: x + 4.5, y: yCenter - size / 2 + 3 },
            thickness: 1.5,
            color: COL_WHITE,
        });
        page.drawLine({
            start: { x: x + 4.5, y: yCenter - size / 2 + 3 },
            end: { x: x + size - 2, y: yCenter + size / 2 - 2 },
            thickness: 1.5,
            color: COL_WHITE,
        });
    }
}

// ─── Shared header ────────────────────────────────────────────────────────────
function drawPageHeader(
    page: PDFPage,
    yTop: number,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    iconImage: any
): number {
    const H = 68;

    // Outer border
    drawRect(page, MARGIN, yTop, CONTENT_W, H, COL_GREY);

    // Divider between logo area and title
    const logoDivX = MARGIN + 230;
    page.drawLine({
        start: { x: logoDivX, y: yTop },
        end: { x: logoDivX, y: yTop - H },
        thickness: 0.75, color: COL_BLACK,
    });

    // ── Logo area ────────────────────────────────────────────────
    if (iconImage) {
        const logoSize = 44;
        page.drawImage(iconImage, {
            x: MARGIN + 15,
            y: yTop - H / 2 - logoSize / 2,
            width: logoSize,
            height: logoSize,
        });
    } else {
        // Red circle fallback
        const circleX = MARGIN + 30;
        const circleY = yTop - H / 2;
        page.drawCircle({ x: circleX, y: circleY, size: 22, color: COL_RED });
        // White inner ring
        page.drawCircle({ x: circleX, y: circleY, size: 17, color: rgb(0.96, 0.96, 0.96), borderColor: COL_WHITE, borderWidth: 0 });
        // "TERA" text
        const teraSize = 9;
        const teraW = fontBold.widthOfTextAtSize("TERA", teraSize);
        page.drawText("TERA", {
            x: circleX - teraW / 2, y: circleY - teraSize * 0.35,
            size: teraSize, font: fontBold, color: COL_RED,
        });
    }

    // Company name
    const nameX = MARGIN + 70;
    page.drawText("บริษัท เทอรา กรุ้ป จำกัด", {
        x: nameX, y: yTop - 28, size: 16, font: fontBold, color: COL_RED,
    });
    page.drawText("TERA GROUP CO.,LTD.", {
        x: nameX, y: yTop - 48, size: 11, font: fontRegular, color: COL_RED,
    });

    // ── Form title (right side) ───────────────────────────────────
    const titleText = "แบบฟอร์มหัวข้อการประชุม";
    const titleSize = 18;
    const titleW = fontBold.widthOfTextAtSize(titleText, titleSize);
    const rightW = MARGIN + CONTENT_W - logoDivX;
    const titleX = logoDivX + (rightW - titleW) / 2;
    page.drawText(titleText, {
        x: titleX, y: yTop - H / 2 - titleSize * 0.15,
        size: titleSize, font: fontBold, color: COL_BLACK,
    });

    return yTop - H;
}

// ─── Info row helper (label | value) ───────────────────────────
function drawInfoRow(
    page: PDFPage,
    yTop: number,
    rowH: number,
    label: string,
    value: string,
    labelW: number,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    labelSize = 12,
    valueSize = 12
): number {
    drawRect(page, MARGIN, yTop, CONTENT_W, rowH);

    // Label
    drawCell(page, label, MARGIN, yTop, labelW, rowH, fontBold, labelSize);

    // Value
    const valueX = MARGIN + labelW;
    const valueW = CONTENT_W - labelW;
    drawCell(page, value, valueX, yTop, valueW, rowH, fontRegular, valueSize, COL_BLACK, "center");

    return yTop - rowH;
}

// ─── Section title bar ────────────────────────────────────────────────────────
function drawSectionBar(
    page: PDFPage,
    yTop: number,
    barH: number,
    text: string,
    fontBold: PDFFont,
    size = 13
): number {
    drawRect(page, MARGIN, yTop, CONTENT_W, barH, COL_GREY);
    drawCell(page, text, MARGIN, yTop, CONTENT_W, barH, fontBold, size, COL_BLACK, "center");
    return yTop - barH;
}

// ─── Main route ───────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    const token = (await cookies()).get("token")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

        const booking = await prisma.room_bookings.findUnique({
            where: { id: Number(id) },
            include: {
                employee: true,
                room: true,
                attendees: {
                    include: {
                        employee: {
                            include: {
                                job_positions: true,
                                departments: true,
                            },
                        },
                    },
                },
            },
        });
        if (!booking) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        // ── Embed fonts & images ───────────────────────────────────────────────────
        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const [regularBytes, boldBytes, iconBytes] = await Promise.all([
            loadFontBytes("public/fonts/Sarabun-Regular.ttf"),
            loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null),
            loadFontBytes("public/icon.jpg").catch(() => null),
        ]);
        const fontRegular = await pdf.embedFont(regularBytes, { subset: true });
        const fontBold = boldBytes
            ? await pdf.embedFont(boldBytes, { subset: true })
            : fontRegular;
            
        const iconImage = iconBytes ? await pdf.embedJpg(iconBytes) : null;

        // ── Format booking data ────────────────────────────────────────────────────
        const startDate = new Date(new Date(booking.start_time).toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const endDate = new Date(new Date(booking.end_time).toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const dateStr = format(startDate, "d/M/yyyy");
        const timeStr = `${format(startDate, "HH.mm")} - ${format(endDate, "HH.mm")} น.`;
        const roomStr = `${booking.room.name} ชั้น ${booking.room.floor ?? "-"}`;
        const isMgmt = booking.purpose === "Management Review Meeting";

        // ── Parse agenda ───────────────────────────────────────────────────────────
        type Agenda = { person: string; details: string };
        let agendas: Agenda[] = [];
        try {
            const raw = booking.minutes ?? "";
            agendas = raw.startsWith("[")
                ? JSON.parse(raw)
                : raw
                    ? [{ person: "", details: raw }]
                    : [];
        } catch {
            agendas = booking.minutes ? [{ person: "", details: booking.minutes }] : [];
        }

        agendas = agendas.filter(a => a.details && a.details.trim().length > 0);

        // ══════════════════════════════════════════════════════════════════════════
        // PAGE 1
        // ══════════════════════════════════════════════════════════════════════════
        const page1 = pdf.addPage([PAGE_W, PAGE_H]);
        let y = PAGE_H - MARGIN;

        // Header
        y = drawPageHeader(page1, y, fontBold, fontRegular, iconImage);

        // ── Subject row ──────────────────────────────────────────────────────────
        const ROW_H = 32;
        drawRect(page1, MARGIN, y, CONTENT_W, ROW_H);

        // "เรื่อง :"
        drawCell(page1, "เรื่อง :", MARGIN, y, 55, ROW_H, fontBold, 12);

        // Checkbox 1
        const cb1X = MARGIN + 58;
        const cbY = y - ROW_H / 2;
        drawCheckbox(page1, cb1X, cbY, 11, isMgmt);
        drawCell(page1, "ประชุมทบทวนฝ่ายบริหาร", cb1X + 14, y, 155, ROW_H, fontRegular, 11);

        // Checkbox 2
        const cb2X = MARGIN + 230;
        drawCheckbox(page1, cb2X, cbY, 11, !isMgmt);
        const purposeLabel = !isMgmt
            ? `อื่นๆ ....... ${booking.purpose ?? ""}`
            : "อื่นๆ .......";
        drawCell(page1, purposeLabel, cb2X + 14, y, CONTENT_W - 230 - 14, ROW_H, fontRegular, 11, COL_BLACK, "left", 6, true);

        y -= ROW_H;

        // ── Date / Time / Session ────────────────────────────────────────────────
        drawRect(page1, MARGIN, y, CONTENT_W, ROW_H);

        // Divide into 3 equal segments
        const seg = CONTENT_W / 3;

        // Segment 1: วันที่
        drawCell(page1, "วันที่ :", MARGIN, y, 48, ROW_H, fontBold, 12);
        drawCell(page1, dateStr, MARGIN + 48, y, seg - 48, ROW_H, fontRegular, 12, COL_BLACK, "center");

        // Segment 2: เวลา
        const s2X = MARGIN + seg;
        drawCell(page1, "เวลา :", s2X, y, 44, ROW_H, fontBold, 12);
        drawCell(page1, timeStr, s2X + 44, y, seg - 44, ROW_H, fontRegular, 12, COL_BLACK, "center");

        // Segment 3: ครั้งที่
        const s3X = MARGIN + seg * 2;
        drawCell(page1, "ครั้งที่ :", s3X, y, 46, ROW_H, fontBold, 12);
        drawCell(page1, String((booking as any).session_no ?? "-"), s3X + 46, y, seg - 46, ROW_H, fontRegular, 12, COL_BLACK, "center");

        y -= ROW_H;

        // ── Location / Chairman / Recorder ───────────────────────────────────────
        const LABEL_W = 120;
        y = drawInfoRow(page1, y, ROW_H, "สถานที่ประชุม :", roomStr, LABEL_W, fontBold, fontRegular);
        y = drawInfoRow(page1, y, ROW_H, "ประธานการประชุม :", "-", LABEL_W, fontBold, fontRegular);
        y = drawInfoRow(page1, y, ROW_H, "ผู้บันทึกประชุม :", booking.employee.name, LABEL_W, fontBold, fontRegular);

        // ── Attendees section ────────────────────────────────────────────────────
        y = drawSectionBar(page1, y, 26, "รายชื่อผู้เข้าร่วมประชุมของแผนก", fontBold, 13);

        // Column definitions: [label, width, align]
        type ColDef = [string, number, "center" | "left"];
        const ATT_COLS: ColDef[] = [
            ["ลำดับ", 45, "center"],
            ["ชื่อ-นามสกุล", 150, "left"],
            ["ชื่อเล่น", 80, "center"],
            ["ตำแหน่ง", 125, "left"],
            ["ฝ่าย/แผนก", CONTENT_W - 45 - 150 - 80 - 125, "left"],
        ];

        // Column header row
        const COL_H = 24;
        drawRect(page1, MARGIN, y, CONTENT_W, COL_H, COL_GREY);
        let cx = MARGIN;
        for (const [label, w, align] of ATT_COLS) {
            drawCell(page1, label, cx, y, w, COL_H, fontBold, 11, COL_BLACK, align);
            cx += w;
        }
        y -= COL_H;

        // Draw vertical column dividers inside header
        cx = MARGIN;
        for (let i = 0; i < ATT_COLS.length - 1; i++) {
            cx += ATT_COLS[i][1];
            page1.drawLine({
                start: { x: cx, y: y + COL_H },
                end: { x: cx, y: y },
                thickness: 0.5, color: COL_BLACK,
            });
        }

        // Attendee rows (always draw 10 rows for blank lines)
        const ATT_ROW_H = 26;
        const ROWS = Math.max(10, booking.attendees.length);
        let currentAttPage = page1;

        for (let i = 0; i < ROWS; i++) {
            // Check for page break
            if (y - ATT_ROW_H < MARGIN) {
                currentAttPage = pdf.addPage([PAGE_W, PAGE_H]);
                y = PAGE_H - MARGIN;
                y = drawPageHeader(currentAttPage, y, fontBold, fontRegular, iconImage);
                y = drawSectionBar(currentAttPage, y, 26, "รายชื่อผู้เข้าร่วมประชุม (ต่อ)", fontBold, 13);
                
                // Redraw column headers on new page
                drawRect(currentAttPage, MARGIN, y, CONTENT_W, COL_H, COL_GREY);
                let headCx = MARGIN;
                for (const [label, w, align] of ATT_COLS) {
                    drawCell(currentAttPage, label, headCx, y, w, COL_H, fontBold, 11, COL_BLACK, align);
                    headCx += w;
                }
                y -= COL_H;
            }

            drawRect(currentAttPage, MARGIN, y, CONTENT_W, ATT_ROW_H);

            const att = i < booking.attendees.length ? booking.attendees[i] : null;
            cx = MARGIN;

            // Draw column vertical dividers
            let divCx = MARGIN;
            for (let ci = 0; ci < ATT_COLS.length - 1; ci++) {
                divCx += ATT_COLS[ci][1];
                currentAttPage.drawLine({
                    start: { x: divCx, y },
                    end: { x: divCx, y: y - ATT_ROW_H },
                    thickness: 0.5, color: COL_BLACK,
                });
            }

            if (att) {
                const emp = att.employee as any;
                const nickname = emp.nickname ? `คุณ${emp.nickname}` : "-";
                const position = emp.job_positions?.title ?? "-";
                const dept = emp.departments?.name ?? "-";

                const rowData = [
                    String(i + 1),
                    emp.name ?? "",
                    nickname,
                    position,
                    dept,
                ];

                for (let ci = 0; ci < ATT_COLS.length; ci++) {
                    const [, w, align] = ATT_COLS[ci];
                    drawCell(currentAttPage, rowData[ci], cx, y, w, ATT_ROW_H, fontRegular, 11, COL_BLACK, align);
                    cx += w;
                }
            }

            y -= ATT_ROW_H;
        }



        // ══════════════════════════════════════════════════════════════════════════
        // PAGE 2
        // ══════════════════════════════════════════════════════════════════════════
        const page2 = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;

        y = drawPageHeader(page2, y, fontBold, fontRegular, iconImage);
        y = drawSectionBar(page2, y, 26, "วาระการประชุมของแผนก", fontBold, 13);

        // ── Agenda blocks ─────────────────────────────────────────────────────────
        const AGENDA_HEADER_H = 28;
        const AGENDA_LINE_H = 22;

        let currentPage = page2;

        for (let i = 0; i < agendas.length; i++) {
            const agenda = agendas[i];

            // Pre-calculate wrapped detail lines
            const wrappedLines = wrapText(agenda.details || "", fontRegular, 11, CONTENT_W - 12);
            const detailRows = Math.max(4, wrappedLines.length);
            const blockH = AGENDA_HEADER_H + (detailRows * AGENDA_LINE_H) + 10;

            // Check if we need a new page
            if (y - blockH < MARGIN) {
                currentPage = pdf.addPage([PAGE_W, PAGE_H]);
                y = PAGE_H - MARGIN;
                y = drawPageHeader(currentPage, y, fontBold, fontRegular, iconImage);
                y = drawSectionBar(currentPage, y, 26, "วาระการประชุม (ต่อ)", fontBold, 13);
            }

            // ── Agenda header row ──────────────────────────────────────────────────
            drawRect(currentPage, MARGIN, y, CONTENT_W, AGENDA_HEADER_H, COL_GREY);

            const agLabel = `วาระที่ ${i + 1} :`;
            const agLabelW = 72;
            drawCell(currentPage, agLabel, MARGIN, y, agLabelW, AGENDA_HEADER_H, fontBold, 12);

            drawCell(
                currentPage,
                agenda.person || ".............................................................................",
                MARGIN + agLabelW, y,
                CONTENT_W - agLabelW, AGENDA_HEADER_H,
                fontRegular, 12
            );

            y -= AGENDA_HEADER_H;

            // ── Detail lines (Dynamic height) ───────────────────────────────────────
            for (let r = 0; r < detailRows; r++) {
                // If a single agenda's details cross a page, that's complex. 
                // For now, we ensure the block starts on a new page if it doesn't fit.
                drawRect(currentPage, MARGIN, y, CONTENT_W, AGENDA_LINE_H);
                const line = wrappedLines[r] ?? "";
                if (line) {
                    drawCell(currentPage, line, MARGIN, y, CONTENT_W, AGENDA_LINE_H, fontRegular, 11);
                }
                y -= AGENDA_LINE_H;
            }

            // Small gap between agenda blocks
            y -= 8;
        }



        // ── Serialize ──────────────────────────────────────────────────────────────
        const saved = await pdf.save();
        const buffer = Buffer.from(saved);

        return new Response(buffer as unknown as BodyInit, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="Morning_Talk_${booking.id}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error("[API/BOOKINGS/EXPORT-PDF]", error);
        return NextResponse.json(
            { error: "INTERNAL_ERROR", message: error.message },
            { status: 500 }
        );
    }
}