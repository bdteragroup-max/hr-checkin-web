const fs = require('fs');
const path = require('path');

// 1. Remove from layout
let layoutPath = 'src/app/admin/layout.tsx';
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

// Replace TabKey
layoutContent = layoutContent.replace(
    'type TabKey = "dashboard" | "attendance" | "leave" | "holiday" | "report" | "projects";',
    'type TabKey = "dashboard" | "attendance" | "leave" | "holiday" | "projects";'
);

// Replace getTabFromSearch
layoutContent = layoutContent.replace(
    'if (t === "attendance" || t === "leave" || t === "holiday" || t === "report" || t === "projects") return t as TabKey;',
    'if (t === "attendance" || t === "leave" || t === "holiday" || t === "projects") return t as TabKey;'
);

// Replace Link
const linkRegex = /<Link\s+href="\/admin\?tab=report"[\s\S]*?<\/Link>/;
layoutContent = layoutContent.replace(linkRegex, '');

fs.writeFileSync(layoutPath, layoutContent, 'utf8');

// 2. Remove from page.tsx (We just skip the render component and TAB_TITLES)
let pagePath = 'src/app/admin/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

pageContent = pageContent.replace(
    /return \(\s*<div className=\{styles\.content\}>\s*<div className=\{styles\.pageHeader\}>[\s\S]*?\{activeTab === "projects" && renderProjects\(\)\}/,
    (match) => {
        return match.replace(/\{activeTab === "report" && renderReport\(\)\}\s*/, '');
    }
);

pageContent = pageContent.replace(
    'report: "สรุปรายเดือน",',
    ''
);

fs.writeFileSync(pagePath, pageContent, 'utf8');
console.log("Successfully removed report tab from UI layout and page rendering.");
