import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { generate50TawiPDF } from '@/lib/pdfGenerator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const adminToken = cookieStore.get('admin_token')?.value;
        const employeeToken = cookieStore.get('token')?.value;

        let p: any;
        let isAdmin = false;

        if (adminToken) {
            try {
                p = verifyToken(adminToken);
                if (p.role === 'admin' || p.role?.includes('_ADMIN') || p.role?.includes('_MANAGER')) {
                    isAdmin = true;
                }
            } catch (e) {}
        }

        if (!isAdmin && employeeToken) {
            try {
                p = verifyToken(employeeToken);
            } catch (e) {}
        }

        if (!p) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const yearStr = searchParams.get('year');
        const targetEmpId = searchParams.get('emp_id');
        const mode = searchParams.get('mode') || 'draft';
        
        if (!yearStr) return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 });
        const year = parseInt(yearStr);
        
        let finalEmpId = p.emp_id;
        if (targetEmpId && targetEmpId !== p.emp_id) {
            if (!isAdmin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
            finalEmpId = targetEmpId;
        }

        if (mode === 'issued') {
            const docRecord = await prisma.withholding_tax_documents.findFirst({
                where: { 
                    emp_id: finalEmpId,
                    issue_date: {
                        gte: new Date(`${year}-01-01`),
                        lte: new Date(`${year}-12-31`)
                    }
                },
                include: { income_items: true },
                orderBy: { created_at: 'desc' }
            });
            
            if (!docRecord) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            
            const pdfBytes = await generate50TawiPDF(docRecord, false);
            return new NextResponse(Buffer.from(pdfBytes), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="50twi_${finalEmpId}_${year}.pdf"`
                }
            });
        } else {
            const emp = await prisma.employees.findUnique({ where: { emp_id: finalEmpId } });
            if (!emp) return NextResponse.json({ error: 'EMP_NOT_FOUND' }, { status: 404 });
            
            const companySettings = await (prisma as any).company_settings.findFirst();
            const companyName = companySettings?.name || 'บริษัท เทอรา กรุ๊ป จำกัด';
            const companyTaxId = companySettings?.tax_id || '0105555123456';
            const companyAddress = companySettings?.address || '-';
            
            const ytdData = await prisma.monthly_payroll_data.findMany({
                where: { emp_id: finalEmpId, cycle_year: year, is_published: true }
            });
            
            const totalIncome = ytdData.reduce((acc, d) => acc + Number((d as any).taxable_income || 0), 0);
            const totalTax = ytdData.reduce((acc, d) => acc + Number(d.tax || 0), 0);
            const totalSso = ytdData.reduce((acc, d) => acc + Number(d.social_security || 0), 0);
            const totalPvd = ytdData.reduce((acc, d) => acc + Number((d as any).provident_fund || 0), 0);
            
            const bahtText = (num: number) => `${num.toFixed(2)} บาท`; 

            const dynamicData = {
                document_number: '',
                payer_name: companyName,
                payer_tax_id: companyTaxId,
                payer_address: companyAddress,
                payee_name: emp.name,
                payee_tax_id: '0000000000000',
                payee_address: '-',
                tax_form_type: 'P.N.D.1',
                total_payment_amount: totalIncome,
                total_tax_withheld: totalTax,
                total_tax_text: bahtText(totalTax),
                deduct_provident_fund_1: 0,
                deduct_social_security: totalSso,
                deduct_provident_fund_2: totalPvd,
                payment_condition: 1,
                issue_date: new Date(),
                signer_name: 'Admin',
                income_items: [
                    { income_type_id: 1, payment_amount: totalIncome, tax_withheld: totalTax }
                ]
            };
            
            const pdfBytes = await generate50TawiPDF(dynamicData, true);
            return new NextResponse(Buffer.from(pdfBytes), {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="50twi_${finalEmpId}_${year}_draft.pdf"`
                }
            });
        }
    } catch (e: any) {
        console.error('50 Tawi PDF Error:', e);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
