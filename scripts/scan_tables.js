const fs = require('fs');
const path = require('path');

const tables = new Set();
function scan(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) scan(full);
    else if (f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.sql')) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g);
      for (const m of matches) tables.add(m[1]);
    }
  });
}
scan('src');
scan('supabase');
console.log('Tables:', Array.from(tables).sort());

