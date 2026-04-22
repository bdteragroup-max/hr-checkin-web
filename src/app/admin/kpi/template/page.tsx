"use client";

import React from "react";
import { 
    DocumentTextIcon, 
    HeartIcon, 
    AcademicCapIcon, 
    LightBulbIcon, 
    CheckBadgeIcon,
    InformationCircleIcon
} from "@heroicons/react/24/outline";
import styles from "./page.module.css";

export default function KPITemplatePage() {
    return (
        <div className={styles.printWrapper}>
            <div className={styles.header}>
                <div className={styles.logoBox}>TERA</div>
                <div className={styles.titleGroup}>
                    <h1>แบบประเมินผลการปฏิบัติงานประจำปี (Annual Performance Evaluation)</h1>
                    <p>คู่มือขั้นตอนการประเมินและเกณฑ์มาตรฐานสำหรับพนักงาน</p>
                </div>
            </div>

            <div className={styles.gridContainer}>
                {/* --- Left Column: Process Flow --- */}
                <div className={styles.flowSection}>
                    <div className={styles.sectionTitle}>
                        <div className={styles.number}>01</div>
                        <h2>ขั้นตอนการประเมิน (Evaluation Process)</h2>
                    </div>
                    
                    <div className={styles.timeline}>
                        <div className={styles.step}>
                            <div className={styles.stepDot}>1</div>
                            <div className={styles.stepContent}>
                                <h3>Definition (หัวหน้างาน)</h3>
                                <p>หัวหน้ากำหนดเป้าหมาย KPIs, Core Values และ Competencies ก่อนเริ่มรอบการประเมิน</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepDot}>2</div>
                            <div className={styles.stepContent}>
                                <h3>Self-Assessment (พนักงาน)</h3>
                                <p>พนักงานระบุผลลัพธ์ที่ทำได้จริง และประเมินคะแนนตนเองในระบบ</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepDot}>3</div>
                            <div className={styles.stepContent}>
                                <h3>Evaluation (หัวหน้างาน)</h3>
                                <p>หัวหน้าพิจารณาผลงาน ให้คะแนนตัดสิน และให้คำแนะนำเพื่อการพัฒนา</p>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <div className={styles.stepDot}>4</div>
                            <div className={styles.stepContent}>
                                <h3>Final Review (ผู้บริหาร)</h3>
                                <p>ฝ่ายบริหารตรวจสอบผลประเมินรวม (Calibration) และสรุปเกรดประจำปี</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.infoBox}>
                        <InformationCircleIcon width={20} />
                        <div>
                            <strong>สัดส่วนคะแนนรวม:</strong><br/>
                            Part 1 (70%) + Part 2 (20%) + Part 3 (10%) = 100%
                        </div>
                    </div>
                </div>

                {/* --- Right Column: The 5 Parts --- */}
                <div className={styles.partsSection}>
                    <div className={styles.sectionTitle}>
                        <div className={styles.number}>02</div>
                        <h2>องค์ประกอบ 5 ส่วน (The 5 Parts)</h2>
                    </div>

                    <div className={styles.partsGrid}>
                        <div className={styles.partCard}>
                            <div className={styles.partNumber}>PART 1</div>
                            <div className={styles.partIcon}><DocumentTextIcon width={32} /></div>
                            <h3>เป้าหมายผลงาน (KPIs)</h3>
                            <div className={styles.weightBadge}>Weight: 70%</div>
                            <p className={styles.desc}>
                                <strong>เกณฑ์การให้คะแนน:</strong><br/>
                                1. บรรลุผลสำเร็จน้อยมากหรือไม่สำเร็จเลย<br/>
                                2. บรรลุผลสำเร็จบางส่วน<br/>
                                3. บรรลุผลสำเร็จตามเป้าหมาย<br/>
                                4. บรรลุผลสำเร็จเกินกว่าเป้าหมาย<br/>
                                5. บรรลุผลสำเร็จเกินกว่าเป้าหมายอย่างมาก
                            </p>
                        </div>

                        <div className={styles.partCard}>
                            <div className={styles.partNumber}>PART 2</div>
                            <div className={styles.partIcon}><HeartIcon width={32} /></div>
                            <h3>ค่านิยมหลัก (Core Values)</h3>
                            <div className={styles.weightBadge}>Weight: 20%</div>
                            <p className={styles.desc}>
                                ประเมินพฤติกรรมตามค่านิยม TERA (Integrity, Accountability, Customer Focus, Teamwork)
                            </p>
                        </div>

                        <div className={styles.partCard}>
                            <div className={styles.partNumber}>PART 3</div>
                            <div className={styles.partIcon}><AcademicCapIcon width={32} /></div>
                            <h3>ความสามารถ (Competency)</h3>
                            <div className={styles.weightBadge}>Weight: 10%</div>
                            <p className={styles.desc}>
                                ประเมินทักษะที่จำเป็น (Leadership, Problem Solving, Technical Skills) <strong>เฉพาะพนักงานระดับบริหาร</strong>
                            </p>
                        </div>

                        <div className={styles.partCard}>
                            <div className={styles.partNumber}>PART 4</div>
                            <div className={styles.partIcon}><LightBulbIcon width={32} /></div>
                            <h3>แผนพัฒนา (Dev Plan)</h3>
                            <div className={styles.weightBadge}>Section</div>
                            <p className={styles.desc}>
                                พนักงานระบุความต้องการในการพัฒนาและเป้าหมายในอาชีพ (Career Goals)
                            </p>
                        </div>

                        <div className={styles.partCard} style={{ gridColumn: 'span 2' }}>
                            <div className={styles.partNumber}>PART 5</div>
                            <div className={styles.partIcon}><CheckBadgeIcon width={32} /></div>
                            <h3>สรุปและเกรด (Summary)</h3>
                            <div className={styles.weightBadge}>Final Result</div>
                            <p className={styles.desc}>
                                สรุปคะแนนรวมทั้งหมดและเกรด (A, B, C, D, E) พร้อมลายเซ็นรับรองจากทุกฝ่าย
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.footer}>
                <p>© 2026 TERA GROUP CO., LTD. - CONFIDENTIAL DOCUMENT</p>
            </div>

            <style jsx global>{`
                @media print {
                    @page { size: A4 landscape; margin: 0; }
                    body { margin: 0; padding: 0; background: white; }
                    .${styles.printWrapper} { box-shadow: none; border-radius: 0; border: none; padding: 20mm; }
                }
            `}</style>
        </div>
    );
}
