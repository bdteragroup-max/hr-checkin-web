import React from 'react';
import styles from './FinalSummary.module.css';

export interface SummaryData {
    totalScore: number; // 2.77
    maxScore: number; // 5.00
    grade: string; // 'C'
    passed: boolean;
    employeeComment: string;
    supervisorComment: string;
}

interface FinalSummaryProps {
    data: SummaryData;
}

const FinalSummary: React.FC<FinalSummaryProps> = ({ data }) => {
    return (
        <div className={styles.container}>
            {/* Header Bar */}
            <div className={styles.headerBar}>
                ส่วนที่ 5: สรุปผลคะแนนและเกรด (Final Summary & Grade)
            </div>

            {/* Score + Grade Row */}
            <div className={styles.scoreRow}>
                <div className={styles.totalScore}>
                    คะแนนรวมสุทธิ: {data.totalScore.toFixed(2)} / {data.maxScore.toFixed(2)}
                </div>
                <div className={styles.gradeBox}>
                    เกรด: {data.grade}
                </div>
            </div>

            {/* Passed/Failed Text */}
            <div className={data.passed ? styles.passedText : styles.failedText}>
                {data.passed ? 'ผ่านการประเมิน (PASSED)' : 'ไม่ผ่านการประเมิน (FAILED)'}
            </div>

            {/* Employee Comments */}
            <div className={styles.commentSection}>
                <div className={styles.commentLabel}>ความเห็นพนักงาน (Employee Comments):</div>
                <div className={styles.commentBox}>
                    {data.employeeComment || '-'}
                </div>
            </div>

            {/* Supervisor Comments */}
            <div className={styles.commentSection}>
                <div className={styles.commentLabel}>ความเห็นผู้บังคับบัญชา (Supervisor Comments):</div>
                <div className={styles.commentBox}>
                    {data.supervisorComment || '-'}
                </div>
            </div>

            {/* Signature Row */}
            <div className={styles.signatureRow}>
                <div className={styles.signatureItem}>
                    <div className={styles.signatureLine}></div>
                    <div className={styles.signatureTitle}>(พนักงาน)</div>
                </div>
                <div className={styles.signatureItem}>
                    <div className={styles.signatureLine}></div>
                    <div className={styles.signatureTitle}>(ผู้ประเมิน (หัวหน้า))</div>
                </div>
                <div className={styles.signatureItem}>
                    <div className={styles.signatureLine}></div>
                    <div className={styles.signatureTitle}>(ฝ่ายบุคคล / ผู้บริหาร)</div>
                </div>
            </div>
        </div>
    );
};

export default FinalSummary;
