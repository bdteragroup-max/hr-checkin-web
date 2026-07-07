import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { generate50TawiPDF } from '@/lib/pdfGenerator';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const adminToken = cookieStore.get("admin_token")?.value;

        if (!adminToken) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        let p: any;
        try {
            p = verifyToken(adminToken);
            if (p.role !== "admin" && !p.role?.includes("_ADMIN") && !p.role?.includes("_MANAGER")) {
                return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
            }
        } catch (e) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const body = await request.json();
        const { employeeId, year } = body;

        if (!employeeId || !year) {
            return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }

        // 1. Check if the document has already been issued for this year (approximate check based on issue_date or we could add `year` column. Let's just check if they have one where issue_date is in that year).
        // For simplicity, we just assume one document per year per employee. We can check by date range.
        const existingDoc = await prisma.withholding_tax_documents.findFirst({
            where: { 
                emp_id: employeeId,
                issue_date: {
                    gte: new Date(`${year}-01-01`),
                    lte: new Date(`${year}-12-31`)
                }
            }
        });
        
        if (existingDoc) {
             return NextResponse.json({ error: "Already issued for this year" }, { status: 400 });
        }

        // Fetch Employee
        const emp = await prisma.employees.findUnique({
            where: { emp_id: employeeId }
        });
        if (!emp) return NextResponse.json({ error: "EMP_NOT_FOUND" }, { status: 404 });

        // Fetch Company Settings
        const companySettings = await (prisma as any).company_settings.findFirst();
        const companyName = companySettings?.name || "บริษัท เทอรา กรุ๊ป จำกัด";
        const companyTaxId = companySettings?.tax_id || "0105555123456";
        const companyAddress = companySettings?.address || "-";

        // Fetch Published Payroll Data for the year
        const ytdData = await prisma.monthly_payroll_data.findMany({
            where: {
                emp_id: employeeId,
                cycle_year: parseInt(year),
                is_published: true
            }
        });

        const totalIncome = ytdData.reduce((acc, d) => acc + Number((d as any).taxable_income || 0), 0);
        const totalTax = ytdData.reduce((acc, d) => acc + Number(d.tax || 0), 0);
        const totalSso = ytdData.reduce((acc, d) => acc + Number(d.social_security || 0), 0);
        const totalPvd = ytdData.reduce((acc, d) => acc + Number((d as any).provident_fund || 0), 0);

        // Helper to convert number to Thai text
        const bahtText = (num: number) => {
             // simplified for now, you can use a library like 'thai-baht-text'
             return `${num.toFixed(2)} บาท`; 
        };

        // 3. Generate Running Number (e.g., WT2023120001)
        // Find last doc for the year/month to increment
        const currentYearStr = new Date().getFullYear().toString();
        const currentMonthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const prefix = `WT${currentYearStr}${currentMonthStr}`;
        
        const lastDoc = await prisma.withholding_tax_documents.findFirst({
            where: { document_number: { startsWith: prefix } },
            orderBy: { document_number: 'desc' }
        });
        
        let nextNumber = 1;
        if (lastDoc) {
             const lastNumStr = lastDoc.document_number.slice(-4);
             nextNumber = parseInt(lastNumStr) + 1;
        }
        const documentNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

        // 4. Save to Database (Snapshot)
        const savedDoc = await prisma.withholding_tax_documents.create({
            data: {
                emp_id: employeeId,
                document_number: documentNumber,
                copy_type: 1, // default to 1 (สำหรับผู้ถูกหักภาษี)
                payer_name: companyName,
                payer_tax_id: companyTaxId,
                payer_address: companyAddress,
                payee_name: emp.name,
                payee_tax_id: "0000000000000", // Would come from employee table if available
                payee_address: "-", // Would come from employee table
                tax_form_type: "P.N.D.1",
                total_payment_amount: totalIncome,
                total_tax_withheld: totalTax,
                total_tax_text: bahtText(totalTax),
                deduct_provident_fund_1: 0,
                deduct_social_security: totalSso,
                deduct_provident_fund_2: totalPvd,
                payment_condition: 1,
                payment_condition_other_desc: null,
                signer_name: "Admin",
                issue_date: new Date(),
                income_items: {
                    create: [
                        {
                            income_type_id: 1,
                            income_description: "เงินเดือน ค่าจ้าง",
                            payment_date: new Date(`${year}-12-31`), // Simplified
                            payment_amount: totalIncome,
                            tax_withheld: totalTax
                        }
                    ]
                }
            }
        });

        return NextResponse.json({ success: true, document: savedDoc });
    } catch (e: any) {
        console.error("Issue 50 Twi Error:", e);
        return NextResponse.json({ error: "INTERNAL_ERROR", details: e.message }, { status: 500 });
    }
}
