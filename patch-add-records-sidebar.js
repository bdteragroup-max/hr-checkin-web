const fs = require('fs');

let layoutPath = 'src/app/admin/layout.tsx';
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

const newLink = `
                            {/* ✅ Historical Records */}
                            <Link
                                href="/admin/records"
                                className={\`\${styles.navItem} \${pathname.startsWith("/admin/records") ? styles.active : ""}\`}
                            >
                                <span className={styles.navIcon}><PresentationChartLineIcon width={20} /></span>สถิติย้อนหลัง
                            </Link>
`;

layoutContent = layoutContent.replace(
    /(\n\s*<\!--[^\n]*-->)?\s*<\/nav>/,
    (match) => {
        return newLink + match;
    }
);

// We need to make sure PresentationChartLineIcon is still imported. I didn't remove it earlier, but just in case.
fs.writeFileSync(layoutPath, layoutContent, 'utf8');
console.log("Added sidebar link for records.");
