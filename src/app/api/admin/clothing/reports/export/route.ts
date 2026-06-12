import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'System';
    workbook.created = new Date();

    // 1. Total Requests by Status
    const statusCounts = await prisma.clothing_requests.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusSheet = workbook.addWorksheet('สถิติคำขอ');
    statusSheet.columns = [
      { header: 'สถานะ', key: 'status', width: 20 },
      { header: 'จำนวน (รายการ)', key: 'count', width: 20 },
    ];
    
    statusSheet.getRow(1).font = { bold: true };
    
    const statusMap: any = {
      pending: "รอดำเนินการ",
      approved: "อนุมัติแล้ว",
      fulfilled: "ส่งมอบแล้ว",
      rejected: "ไม่อนุมัติ"
    };

    statusCounts.forEach(sc => {
      statusSheet.addRow({
        status: statusMap[sc.status] || sc.status,
        count: sc._count.id
      });
    });

    // 2. Total items distributed
    const fulfilledRequests = await prisma.clothing_requests.findMany({
      where: { status: 'fulfilled' },
      include: {
        variant: {
          include: { item: true }
        }
      }
    });

    const itemDistribution: Record<string, number> = {};
    for (const req of fulfilledRequests) {
      const name = `${req.variant.item.name} (${req.variant.size})`;
      itemDistribution[name] = (itemDistribution[name] || 0) + req.quantity;
    }

    const distSheet = workbook.addWorksheet('สินค้าที่เบิกบ่อย');
    distSheet.columns = [
      { header: 'ชื่อสินค้า', key: 'name', width: 40 },
      { header: 'จำนวน (ตัว)', key: 'count', width: 20 },
    ];
    distSheet.getRow(1).font = { bold: true };

    const sortedItems = Object.entries(itemDistribution).sort((a: any, b: any) => b[1] - a[1]);
    sortedItems.forEach(([name, count]) => {
      distSheet.addRow({ name, count });
    });

    // 3. Stock Levels
    const stockLevels = await prisma.clothing_variants.findMany({
      include: { item: true },
      orderBy: [
        { item: { name: 'asc' } },
        { size: 'asc' }
      ]
    });

    const stockSheet = workbook.addWorksheet('สต๊อกสินค้าทั้งหมด');
    stockSheet.columns = [
      { header: 'ชื่อสินค้า', key: 'name', width: 40 },
      { header: 'ไซส์', key: 'size', width: 15 },
      { header: 'สต๊อกคงเหลือ', key: 'stock', width: 20 },
    ];
    stockSheet.getRow(1).font = { bold: true };

    stockLevels.forEach(v => {
      stockSheet.addRow({
        name: v.item.name,
        size: v.size,
        stock: v.stock_quantity
      });
    });

    // 4. Detailed Request History
    const allRequests = await prisma.clothing_requests.findMany({
      include: {
        employee: true,
        variant: { include: { item: true } }
      },
      orderBy: { requested_at: 'desc' }
    });

    const historySheet = workbook.addWorksheet('ประวัติการเบิกทั้งหมด');
    historySheet.columns = [
      { header: 'วันที่เบิก', key: 'date', width: 20 },
      { header: 'ชื่อพนักงาน', key: 'empName', width: 30 },
      { header: 'สินค้า', key: 'item', width: 40 },
      { header: 'ไซส์', key: 'size', width: 10 },
      { header: 'จำนวน', key: 'qty', width: 10 },
      { header: 'สถานะ', key: 'status', width: 20 },
    ];
    historySheet.getRow(1).font = { bold: true };

    allRequests.forEach(r => {
      historySheet.addRow({
        date: r.requested_at ? new Date(r.requested_at).toLocaleDateString('th-TH') : '-',
        empName: r.employee?.name || 'ไม่ทราบชื่อ',
        item: r.variant?.item?.name || '-',
        size: r.variant?.size || '-',
        qty: r.quantity,
        status: statusMap[r.status] || r.status
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="clothing_reports_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export Admin Reports Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
