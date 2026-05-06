import React from 'react';
import styles from './ThaiCommentBox.module.css';

interface ThaiCommentBoxProps {
    header: string;
    content: string;
}

const ThaiCommentBox: React.FC<ThaiCommentBoxProps> = ({ header, content }) => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                {header}
            </div>
            <div className={styles.contentBox}>
                {content}
            </div>
        </div>
    );
};

export default ThaiCommentBox;
