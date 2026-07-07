import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

export async function generate50TawiPDF(data: any, isDraft: boolean = false) {
  // 1. Load blank template
  const templatePath = path.join(process.cwd(), 'public', '50twi_template.pdf');
  let pdfDoc: PDFDocument;
  
  try {
    const existingPdfBytes = fs.readFileSync(templatePath);
    pdfDoc = await PDFDocument.load(existingPdfBytes);
  } catch (error) {
    console.warn("Template PDF not found at", templatePath, ". Creating a blank PDF for testing.");
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595.28, 841.89]); // A4 size
  }

  // 2. Register Fontkit for Thai language support
  pdfDoc.registerFontkit(fontkit);
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf');
  let customFont;
  try {
    const fontBytes = fs.readFileSync(fontPath);
    customFont = await pdfDoc.embedFont(fontBytes);
  } catch (error) {
    console.warn("Thai font not found at", fontPath, ". Using standard font (Thai chars might not render correctly).");
    customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const fontSize = 12;
  const drawOptions = { size: fontSize, font: customFont, color: rgb(0, 0, 0) };

  // Helper to format currency
  const formatCurrency = (val: any) => {
    if (!val) return '0.00';
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper to draw 13-digit Tax ID in FlowAccount boxes
  const drawTaxId = (taxId: string, startX: number, y: number) => {
    if (!taxId) return;
    const cleanId = taxId.replace(/[^0-9]/g, '').padEnd(13, ' ');
    let currX = startX;
    for (let i = 0; i < 13; i++) {
      firstPage.drawText(cleanId[i], { x: currX, y, ...drawOptions });
      // Spacing based on standard 50 Tawi boxes: [1]-[2345]-[67890]-[12]-[3]
      if (i === 0) currX += 20;
      else if (i === 4) currX += 23;
      else if (i === 9) currX += 21;
      else if (i === 11) currX += 23;
      else currX += 13;
    }
  };

  // 3. Draw Data on specific X, Y coordinates matching standard FlowAccount 50 Tawi
  
  // Document number
  firstPage.drawText(data.document_number || '', { x: 460, y: 775, ...drawOptions });

  // Payer (Company)
  drawTaxId(data.payer_tax_id || '', 367, 743);
  firstPage.drawText(data.payer_name || '', { x: 80, y: 712, ...drawOptions });
  firstPage.drawText(data.payer_address || '', { x: 80, y: 697, ...drawOptions });

  // Payee (Employee)
  drawTaxId(data.payee_tax_id || '', 367, 655);
  firstPage.drawText(data.payee_name || '', { x: 80, y: 622, ...drawOptions });
  firstPage.drawText(data.payee_address || '', { x: 80, y: 607, ...drawOptions });

  // Check the tax form type checkbox (P.N.D. 1 is usually the first one)
  firstPage.drawText('X', { x: 184, y: 566, ...drawOptions }); // ภ.ง.ด.1 ก

  // Income table (Section 40(1) Salary)
  const incomeItems = data.income_items || [];
  const salaryItem = incomeItems.find((item: any) => item.income_type_id === 1) || { payment_amount: data.total_payment_amount, tax_withheld: data.total_tax_withheld };
  
  if (salaryItem && Number(salaryItem.payment_amount) > 0) {
    firstPage.drawText(formatCurrency(salaryItem.payment_amount), { x: 410, y: 470, ...drawOptions });
    firstPage.drawText(formatCurrency(salaryItem.tax_withheld), { x: 500, y: 470, ...drawOptions });
    // Date of payment (usually end of year for summary)
    firstPage.drawText('31/12/2569', { x: 330, y: 470, ...drawOptions, size: 10 }); 
  }
  
  // Total line
  firstPage.drawText(formatCurrency(data.total_payment_amount), { x: 410, y: 220, ...drawOptions });
  firstPage.drawText(formatCurrency(data.total_tax_withheld), { x: 500, y: 220, ...drawOptions });
  
  // Total text
  firstPage.drawText(data.total_tax_text || '', { x: 180, y: 200, ...drawOptions });

  // Deductions (SSO, PVD)
  if (data.deduct_social_security && Number(data.deduct_social_security) > 0) {
    firstPage.drawText(formatCurrency(data.deduct_social_security), { x: 350, y: 172, ...drawOptions });
  }
  if (data.deduct_provident_fund_2 && Number(data.deduct_provident_fund_2) > 0) {
    firstPage.drawText(formatCurrency(data.deduct_provident_fund_2), { x: 500, y: 172, ...drawOptions });
  }

  // Payment condition (1 = Deduct at source)
  if (data.payment_condition === 1) {
    firstPage.drawText('X', { x: 135, y: 153, ...drawOptions });
  }

  // Date and Signature
  if (data.issue_date) {
    const dateObj = new Date(data.issue_date);
    firstPage.drawText(dateObj.getDate().toString().padStart(2, '0'), { x: 320, y: 55, ...drawOptions });
    firstPage.drawText((dateObj.getMonth() + 1).toString().padStart(2, '0'), { x: 360, y: 55, ...drawOptions });
    firstPage.drawText((dateObj.getFullYear() + 543).toString(), { x: 400, y: 55, ...drawOptions });
  }
  firstPage.drawText(data.signer_name || '', { x: 350, y: 85, ...drawOptions });

  // 4. Handle Draft Watermark
  if (isDraft) {
    firstPage.drawText('DRAFT / ร่าง', {
      x: 150,
      y: 400,
      size: 80,
      font: customFont,
      color: rgb(1, 0, 0),
      opacity: 0.3,
      rotate: degrees(45),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
