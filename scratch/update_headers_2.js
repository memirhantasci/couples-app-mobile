const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/app/(tabs)');
const files = [
  'add-daily-note.tsx', 'add-memory.tsx', 'calendar.tsx', 
  'daily-notes.tsx', 'letters.tsx', 'medicine.tsx', 'memories.tsx'
];

const menuButtonCode = `
        <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", position: "absolute", top: 40, right: 20, zIndex: 50 }}>
          <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
        </TouchableOpacity>
`;

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (!content.includes('AlignJustify')) {
    content = content.replace(/import {([^}]+)} from "lucide-react-native";/, (match, p1) => {
      return `import {${p1}, AlignJustify} from "lucide-react-native";`;
    });
    changed = true;
  }
  
  if (!content.includes('import { useRouter }')) {
    content = content.replace(/import React/, 'import { useRouter } from "expo-router";\nimport React');
  }

  if (file === "letters.tsx" || file === "memories.tsx" || file === "daily-notes.tsx") {
    // Inject right inside <ScreenBackground style={...}> or <ScreenBackground>
    content = content.replace(/(<ScreenBackground[^>]*>)/, `$1\n${menuButtonCode}`);
    changed = true;
  } else if (file === "calendar.tsx" || file === "medicine.tsx") {
    // Inject right inside <SafeAreaView...>
    content = content.replace(/(<SafeAreaView[^>]*>)/, `$1\n${menuButtonCode}`);
    changed = true;
  } else if (file === "add-daily-note.tsx" || file === "add-memory.tsx") {
    // Inject right inside <ScreenBackground>
    content = content.replace(/(<ScreenBackground[^>]*>)/, `$1\n${menuButtonCode}`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated", file);
  }
});
