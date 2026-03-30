const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src/app/api');

function walk(d) {
    let res = [];
    let list;
    try { list = fs.readdirSync(d); } catch(e) { return res; }
    for (const file of list) {
        const p = path.join(d, file);
        if (fs.statSync(p).isDirectory()) {
            res = res.concat(walk(p));
        } else if (p.endsWith('route.ts')) {
            res.push(p);
        }
    }
    return res;
}

const files = walk(dir);
let count = 0;

for (const f of files) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('requireAdmin') && !content.includes('export const dynamic = \"force-dynamic\"')) {
        let lines = content.split('\n');
        // Find the topmost line that has an import
        let insertIndex = lines.findIndex(l => !l.startsWith('import ') && l.trim() !== '');
        if (insertIndex === -1) insertIndex = 0;
        
        lines.splice(insertIndex, 0, '\nexport const dynamic = "force-dynamic";\n');
        fs.writeFileSync(f, lines.join('\n'));
        console.log("Updated: " + f);
        count++;
    }
}

console.log(`Fixed ${count} files.`);
