const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/emirh/Desktop/couples-app-mobile/src/app/(tabs)';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix profile.tsx useAuth to include profile
  if (file === 'profile.tsx') {
    content = content.replace('const { session, signOut } = useAuth();', 'const { session, profile, signOut } = useAuth();');
  }

  content = content.replace(/<TouchableOpacity onPress=\{\(\) => router\.push\("\/menu"\)\} style=\{\{(.*?)\}\}>\s*<Menu color="#fff" size=\{24\} \/>\s*<\/TouchableOpacity>/g, (match, styleContent) => {
      let newStyle = styleContent;
      if (!newStyle.includes('flexDirection')) {
          newStyle = 'flexDirection: "row", alignItems: "center", gap: 8, ' + newStyle;
      }
      return `<TouchableOpacity onPress={() => router.push("/menu")} style={{${newStyle}}}>
          {profile?.displayName && <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" }}>{profile.displayName}</Text>}
          <Menu color="#fff" size={24} />
        </TouchableOpacity>`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
}
