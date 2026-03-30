const fs = require('fs');
const path = require('path');

let pagePath = 'src/app/admin/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

// 1. Remove "report" from tabFromQuery
pageContent = pageContent.replace(
    'if (v === "attendance" || v === "leave" || v === "holiday" || v === "report" || v === "projects") return v as TabKey;',
    'if (v === "attendance" || v === "leave" || v === "holiday" || v === "projects") return v as TabKey;'
);

// 2. Remove loadReport from activeTab switch (line 314)
pageContent = pageContent.replace(
    'if (activeTab === "report") loadReport();',
    '// if (activeTab === "report") loadReport();'
);

// 3. Cast activeTab or bypass in useEffect (line 527)
// Instead of breaking the effect if it still existed, let's just make it ignore since report tab is gone.
pageContent = pageContent.replace(
    /if \(activeTab !== "report"\) return;/g,
    'if ((activeTab as string) !== "report") return;'
);

fs.writeFileSync(pagePath, pageContent, 'utf8');
console.log("Patched leftover activeTab checks.");
