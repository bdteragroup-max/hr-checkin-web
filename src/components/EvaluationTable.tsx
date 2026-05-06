import React from 'react';
import styles from './EvaluationTable.module.css';

export interface EvaluationRow { 
    id: number; 
    topic: string; 
    type: 'check' | 'range'; 
    rangeLabels?: string[]; // e.g. ['0','1-2','3-5','6-10','>11'] 
    selectedScore: number; // 1-5 
    weight: number; 
    totalScore: number; 
    comment?: string;
}

export interface SummaryData { 
    maxScore: number; 
    totalScore: number; 
    grade: string;
}

interface EvaluationTableProps {
    data: EvaluationRow[];
    summary: SummaryData;
}

const EvaluationTable: React.FC<EvaluationTableProps> = ({ data, summary }) => {
    const scores: number[] = [5, 4, 3, 2, 1];

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.topicCol}>หัวข้อพิจารณา</th>
                        {scores.map(s => (
                            <th key={s} className={styles.scoreCol}>{s}</th>
                        ))}
                        <th className={styles.weightCol}>น.น ความสำคัญ</th>
                        <th className={styles.totalCol}>คะแนนที่ได้ (×น.น)</th>
                        <th className={styles.commentCol}>ความคิดเห็น</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.id}>
                            <td className={styles.topicCell}>{row.id}. {row.topic}</td>
                            {scores.map((s, idx) => (
                                <td key={s} className={styles.checkCell}>
                                    {row.type === 'range' && row.rangeLabels ? (
                                        <div className={styles.rangeContainer}>
                                            <div className={styles.rangeLabel}>{row.rangeLabels[idx]}</div>
                                            <div className={styles.rangeCheck}>
                                                {row.selectedScore === s ? '✓' : ''}
                                            </div>
                                        </div>
                                    ) : (
                                        row.selectedScore === s ? '✓' : ''
                                    )}
                                </td>
                            ))}
                            <td className={styles.centerCell}>{row.weight}</td>
                            <td className={styles.centerCellBold}>{row.totalScore}</td>
                            <td className={styles.commentCell}>
                                <div className={styles.commentContent}>
                                    {row.comment || ''}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={1} className={styles.footerLabel}>
                            คะแนนเต็ม {summary.maxScore} คะแนน
                        </td>
                        <td colSpan={6} className={styles.footerTotal}>
                            รวมทั้งหมดได้ {summary.totalScore} คะแนน
                        </td>
                        <td colSpan={2} className={styles.footerGrade}>
                            เกรด {summary.grade}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default EvaluationTable;
