import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadFontBytes(relPath: string) {
    const abs = path.join(process.cwd(), relPath);
    return fs.readFile(abs);
}

export async function GET(req: Request) {
    try {
        await requireAdmin();

        const url = new URL(req.url);
        const id = url.searchParams.get("id");

        if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

        const claim = await prisma.commission_claims.findUnique({
            where: { id },
            include: {
                employee: {
                    include: { job_positions: true, departments: true }
                }
            }
        });

        if (!claim) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

        // Fetch companion names
        const companions = await prisma.employees.findMany({
            where: { emp_id: { in: claim.companion_ids } },
            select: { name: true }
        });
        const companionNames = companions.map(c => c.name).join(", ");

        // Fetch supervisor name
        let supervisorName = "-";
        if (claim.supervisor_id) {
            const sv = await prisma.employees.findUnique({
                where: { emp_id: claim.supervisor_id },
                select: { name: true }
            });
            if (sv) supervisorName = sv.name;
        }

        // Fetch HR name if approved_by looks like an ID (fallback)
        let hrName = claim.approved_by || "-";
        if (claim.approved_by) {
            const hr = await prisma.employees.findUnique({
                where: { emp_id: claim.approved_by },
                select: { name: true }
            });
            if (hr) hrName = hr.name;
        }

        const pdf = await PDFDocument.create();
        pdf.registerFontkit(fontkit);

        const fontRegularBytes = await loadFontBytes("public/fonts/Sarabun-Regular.ttf");
        const fontBoldBytes = await loadFontBytes("public/fonts/Sarabun-Bold.ttf").catch(() => null);

        const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: true });
        const fontBold = fontBoldBytes ? await pdf.embedFont(fontBoldBytes, { subset: true }) : fontRegular;

        let page = pdf.addPage([841.89, 595.28]); // A4 Landscape
        let { width, height } = page.getSize();

        const drawText = (text: string, x: number, y: number, size = 12, bold = false) => {
            page.drawText(text, { x, y, size, font: bold ? fontBold : fontRegular, color: rgb(0,0,0) });
        };

        const drawLine = (x1: number, y1: number, x2: number, y2: number, thickness = 1) => {
            page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0,0,0) });
        };

        const drawRect = (x: number, y: number, w: number, h: number, thickness = 1) => {
            page.drawRectangle({ x, y, width: w, height: h, borderWidth: thickness, borderColor: rgb(0,0,0), color: rgb(1,1,1), opacity: 0 });
        };

        const wrapText = (text: string, maxWidth: number, font: any, fontSize: number) => {
            const chars = Array.from(text);
            let lines: string[] = [];
            let currentLine = "";

            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                const testLine = currentLine + char;
                const width = font.widthOfTextAtSize(testLine, fontSize);

                // Thai combining marks range
                const isCombining = char.match(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/);

                if (width > maxWidth && currentLine !== "" && !isCombining) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        };

        const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, size = 11, bold = false) => {
            const lines = wrapText(text, maxWidth, bold ? fontBold : fontRegular, size);
            const lineHeight = size * 1.5;
            lines.forEach((line, i) => {
                drawText(line, x, y - (i * lineHeight), size, bold);
            });
            return lines.length;
        };

        // Header
        drawText("บริษัท เทอรา กรุ๊ป จำกัด", 100, 550, 16, true);
        drawText("TERA GROUP CO., LTD.", 100, 530, 12, true);
        drawText("ใบเบิกค่าคอมมิชชั่น (งานติดตั้งอินเวอร์เตอร์)", 350, 540, 18, true);

        // Employee Info
        drawText("รหัสพนักงาน", 50, 480, 11, true);
        drawText(claim.emp_id, 115, 480, 11);
        drawLine(110, 478, 190, 478);

        drawText("ชื่อ สกุล", 210, 480, 11, true);
        drawText(claim.employee.name, 260, 480, 11);
        drawLine(255, 478, 410, 478);

        drawText("ตำแหน่ง", 430, 480, 11, true);
        drawText(claim.employee.job_positions?.title || "-", 480, 480, 11);
        drawLine(475, 478, 620, 478);

        drawText("ฝ่าย/แผนก", 640, 480, 11, true);
        drawText(claim.employee.departments?.name || "-", 700, 480, 11);
        drawLine(695, 478, 820, 478);

        // Table
        let tableY = 440;
        let tableH = 300;
        let colX = [50, 120, 300, 450, 550, 650, 750, 830];
        
        // Horizontal Lines
        drawLine(colX[0], tableY, colX[7], tableY, 1.5);
        drawLine(colX[0], tableY - 40, colX[7], tableY - 40, 1.5);
        drawLine(colX[0], tableY - tableH, colX[7], tableY - tableH, 1.5);

        // Vertical Lines
        for (const x of colX) {
            drawLine(x, tableY, x, tableY - tableH, 1.5);
        }

        // Headers
        drawText("วันที่", colX[0] + 20, tableY - 25, 12, true);
        drawText("ผู้ร่วมเดินทาง ดังนี้", colX[1] + 40, tableY - 25, 12, true);
        drawText("ชื่อลูกค้า", colX[2] + 40, tableY - 25, 12, true);
        drawText("พนักงานลงนาม", colX[3] + 5, tableY - 25, 11, true);
        drawText("ผู้อนุมัติ", colX[4] + 30, tableY - 15, 11, true);
        drawText("หัวหน้า/ผจก. แผนก", colX[4] + 2, tableY - 30, 10, true);
        drawText("ฝ่ายบุคคล", colX[5] + 25, tableY - 25, 11, true);
        drawText("ผู้บันทึกข้อมูล", colX[6] + 15, tableY - 25, 11, true);

        // Data Row 1
        let rowY = tableY - 60;
        let cellPadding = 5;
        
        drawText(claim.date.toLocaleDateString("th-TH"), colX[0] + cellPadding, rowY, 11);
        
        drawWrappedText(companionNames, colX[1] + cellPadding, rowY, (colX[2] - colX[1]) - (cellPadding * 2), 10);
        
        drawWrappedText(claim.customer_name, colX[2] + cellPadding, rowY, (colX[3] - colX[2]) - (cellPadding * 2), 10);
        
        drawWrappedText(claim.employee.name, colX[3] + cellPadding, rowY, (colX[4] - colX[3]) - (cellPadding * 2), 10);
        
        if (claim.supervisor_approved_at) {
            drawWrappedText(supervisorName, colX[4] + cellPadding, rowY, (colX[5] - colX[4]) - (cellPadding * 2), 10);
        }
        if (claim.approved_at) {
            drawWrappedText(hrName, colX[5] + cellPadding, rowY, (colX[6] - colX[5]) - (cellPadding * 2), 10);
        }

        // Notes
        let footerY = tableY - tableH - 30;
        drawText("หมายเหตุ", 50, footerY, 10, true);
        drawText("1. ค่าติดตั้งอินเวอร์เตอร์ POWTRAN ทุกรุ่น จ่ายค่าคอมมิชชั่น 1% ของราคาขาย ก่อน VAT", 150, footerY, 9);
        drawText("2. ค่าคอมมิชชั่นที่ได้รับจะหารเฉลี่ยตามจำนวนผู้ร่วมเดินทางทั้งหมด", 150, footerY - 15, 9);

        const saved = await pdf.save();
        const bytes = Uint8Array.from(saved as unknown as Uint8Array);
        const body = Buffer.from(bytes) as unknown as BodyInit;

        return new Response(body, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="commission_${claim.id.substring(0, 8)}.pdf"`,
            },
        });

    } catch (e: any) {
        console.error("Commission export error:", e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
