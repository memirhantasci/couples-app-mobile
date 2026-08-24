const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/app/(tabs)');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix duplicate useRouter import
  if (content.includes('import { useRouter } from "expo-router";') && content.includes('useRouter') && content.match(/useRouter/g).length > 2) {
      // Check if there are multiple imports of useRouter
      const matches = content.match(/import\s+{([^}]*useRouter[^}]*)}\s+from\s+"expo-router";/g);
      if (matches && matches.length > 1) {
          // If there are multiple, remove the simple one we added
          content = content.replace(/import { useRouter } from "expo-router";\n/, '');
          changed = true;
      }
      
      if (content.includes('import { useRouter } from "expo-router";') && content.match(/import\s+{([^}]*useRouter[^}]*)}\s+from\s+"expo-router";/g).length > 1) {
           content = content.replace(/import { useRouter } from "expo-router";\n/, '');
           changed = true;
      }
  }

  // A more robust fix for the duplicate import:
  const routerMatch = content.match(/import\s+{([^}]*useRouter[^}]*)}\s+from\s+"expo-router"/g);
  if (routerMatch && routerMatch.length > 1) {
      content = content.replace('import { useRouter } from "expo-router";\n', '');
      changed = true;
  }

  // Fix comma syntax errors from lucide-react-native
  if (content.includes(', , AlignJustify')) {
      content = content.replace(/, , AlignJustify/g, ', AlignJustify');
      changed = true;
  }
  if (content.includes(',\r\n, AlignJustify')) {
      content = content.replace(/,\r\n, AlignJustify/g, ',\r\nAlignJustify');
      changed = true;
  }
  if (content.includes(',\n, AlignJustify')) {
      content = content.replace(/,\n, AlignJustify/g, ',\nAlignJustify');
      changed = true;
  }
  // also catch cases where trailing comma is immediately followed by , AlignJustify
  content = content.replace(/,\s*,\s*AlignJustify/g, ', AlignJustify');

  if (content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Fixed syntax in", file);
  }
});
