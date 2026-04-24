import os
import urllib.request
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors

def download_font(filename, url):
    if not os.path.exists(filename):
        print(f"Downloading {filename}...")
        urllib.request.urlretrieve(url, filename)

def create_meeting_form(output_filename="Morning_Talk_Agenda.pdf"):
    # Download Sarabun fonts from Google Fonts
    font_regular_url = "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf"
    font_bold_url = "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf"
    
    download_font("Sarabun-Regular.ttf", font_regular_url)
    download_font("Sarabun-Bold.ttf", font_bold_url)

    pdfmetrics.registerFont(TTFont('THSarabun', 'Sarabun-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('THSarabun-Bold', 'Sarabun-Bold.ttf'))

    c = canvas.Canvas(output_filename, pagesize=A4)
    width, height = A4
    
    # ==========================
    # PAGE 1: Meeting Information
    # ==========================
    
    # Logo Placeholder
    c.setLineWidth(1)
    c.rect(2*cm, height - 3.5*cm, 3*cm, 2*cm)
    c.setFont("THSarabun", 14)
    c.drawCentredString(3.5*cm, height - 2.6*cm, "LOGO")

    # Company Name
    c.setFont("THSarabun-Bold", 20)
    c.drawCentredString(width/2, height - 2*cm, "บริษัท เทอร่า กรุ๊ป จำกัด (Tera Group Co., Ltd.)")
    
    # Form Name
    c.setFont("THSarabun-Bold", 24)
    c.drawCentredString(width/2, height - 3*cm, "แบบฟอร์มหัวข้อการประชุม (Meeting Topic Form)")

    # Line Separator
    c.setLineWidth(1.5)
    c.line(2*cm, height - 3.5*cm - 5*mm, width - 2*cm, height - 3.5*cm - 5*mm)

    # Subject Row
    y_pos = height - 4.5*cm
    c.setFont("THSarabun-Bold", 16)
    c.drawString(2*cm, y_pos, "เรื่องที่ประชุม (Subject):")
    
    # Checkboxes
    c.rect(5.5*cm, y_pos, 4*mm, 4*mm)
    c.setFont("THSarabun", 16)
    c.drawString(6.1*cm, y_pos, "Management Review Meeting")
    
    c.rect(11.5*cm, y_pos, 4*mm, 4*mm)
    c.drawString(12.1*cm, y_pos, "อื่นๆ (Other) ........................................")

    # Data Rows
    y_pos -= 1*cm
    c.setFont("THSarabun-Bold", 16)
    c.drawString(2*cm, y_pos, "วันที่ (Date):")
    c.drawString(7.5*cm, y_pos, "เวลา (Time):")
    c.drawString(13*cm, y_pos, "ครั้งที่ (Meeting No.):")
    
    c.setLineWidth(0.5)
    c.line(3.7*cm, y_pos, 7*cm, y_pos)
    c.line(9*cm, y_pos, 12.5*cm, y_pos)
    c.line(15.8*cm, y_pos, 19*cm, y_pos)

    y_pos -= 1*cm
    c.drawString(2*cm, y_pos, "สถานที่ (Location):")
    c.line(4.5*cm, y_pos, 19*cm, y_pos)

    y_pos -= 1*cm
    c.drawString(2*cm, y_pos, "ประธานในที่ประชุม (Chairman):")
    c.drawString(11*cm, y_pos, "ผู้จดบันทึก (Recorder):")
    c.line(6.5*cm, y_pos, 10.5*cm, y_pos)
    c.line(14.5*cm, y_pos, 19*cm, y_pos)

    # Attendee List Table
    y_pos -= 1.5*cm
    c.setFont("THSarabun-Bold", 18)
    c.drawString(2*cm, y_pos, "รายชื่อผู้เข้าร่วมประชุม (Department Attendee List)")
    
    y_pos -= 5*mm
    
    # Table Data
    data = [
        ['ลำดับ\n(Seq)', 'ชื่อ-นามสกุล\n(First Name-Surname)', 'ชื่อเล่น\n(Nickname)', 'ตำแหน่ง\n(Position)', 'แผนก/ฝ่าย\n(Dept/Section)']
    ]
    
    # Empty rows for form
    for i in range(1, 16):
        data.append([str(i), '', '', '', ''])

    col_widths = [1.5*cm, 6*cm, 2.5*cm, 3.5*cm, 3.5*cm]
    t = Table(data, colWidths=col_widths, rowHeights=8*mm)
    
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'THSarabun'),
        ('FONTNAME', (0,0), (-1,0), 'THSarabun-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 14),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 1, colors.black),
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
    ]))
    
    t.wrapOn(c, width, height)
    t.drawOn(c, 2*cm, y_pos - (16 * 8*mm))

    c.showPage()
    
    # ==========================
    # PAGE 2: Meeting Agenda
    # ==========================
    
    # Header
    c.setFont("THSarabun-Bold", 24)
    c.drawCentredString(width/2, height - 2*cm, "วาระการประชุม (Department Meeting Agenda)")
    
    c.setLineWidth(1.5)
    c.line(2*cm, height - 2.5*cm, width - 2*cm, height - 2.5*cm)
    
    y_pos = height - 3.5*cm
    
    # Agenda Items Boxes
    for i in range(1, 6):
        c.setFont("THSarabun-Bold", 16)
        c.drawString(2*cm, y_pos, f"วาระที่ {i} (Agenda {i}): .............................................................................................................................................................")
        
        y_pos -= 5*mm
        
        # Details Table for each agenda
        agenda_data = [
            ['ผู้รับผิดชอบ (Person in Charge)', 'รายละเอียดงาน / ข้อสรุป (Task Details / Conclusion)']
        ]
        agenda_data.append(['', ''])
        agenda_data.append(['', ''])
        agenda_data.append(['', ''])
        
        t_agenda = Table(agenda_data, colWidths=[5*cm, 12*cm], rowHeights=[8*mm, 10*mm, 10*mm, 10*mm])
        t_agenda.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'THSarabun'),
            ('FONTNAME', (0,0), (-1,0), 'THSarabun-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 14),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 1, colors.black),
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ]))
        
        t_agenda.wrapOn(c, width, height)
        y_pos -= (4 * 10*mm) - 8*mm # approximate table height
        t_agenda.drawOn(c, 2*cm, y_pos)
        
        y_pos -= 1.5*cm

    c.save()
    print(f"Successfully generated {output_filename}")

if __name__ == "__main__":
    create_meeting_form()
