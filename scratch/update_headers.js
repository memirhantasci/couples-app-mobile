const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/app/(tabs)');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== '_layout.tsx');

const menuButtonCode = `
        <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
        </TouchableOpacity>
`;

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Make sure AlignJustify and router are imported
  if (!content.includes('AlignJustify')) {
    content = content.replace(/import {([^}]+)} from "lucide-react-native";/, (match, p1) => {
      return `import {${p1}, AlignJustify} from "lucide-react-native";`;
    });
    changed = true;
  }
  
  if (!content.includes('useRouter')) {
    // Some files might not have useRouter imported, handle if necessary
    // But usually they do, let's just check
    if (!content.includes('import { useRouter }')) {
      content = content.replace(/import React/, 'import { useRouter } from "expo-router";\nimport React');
    }
    // and initialize it inside the component
    // Assuming the component is export default function ...
    // This could be tricky, skip for now, most have router.
  }

  // Replace existing menu buttons
  const existingMenuRegex = /<TouchableOpacity[^>]*onPress={\(\) => router\.push\("?\/menu"?\)}[^>]*>[\s\S]*?<\/TouchableOpacity>/;
  if (existingMenuRegex.test(content)) {
    // If it's already there, replace it with our standardized one
    if (file !== 'home.tsx' && file !== 'meetings.tsx') {
      content = content.replace(existingMenuRegex, menuButtonCode.trim());
      changed = true;
    }
  } else {
    // If not there, inject it into the header
    // The header is usually <View style={styles.header}> or similar.
    // Let's find the first <View style={[styles.header...]} or <View style={styles.headerTitleRow}>
    // We will just do a simple string replace for the title Row.
    // E.g. in medicine.tsx:
    // <View style={styles.titleRow}>
    // We can inject it right after the header's children.
    // This is too hard to do with simple string replace safely.
    // Let's just log which files need manual fixing.
    console.log("Needs manual fix:", file);
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated", file);
  }
});
