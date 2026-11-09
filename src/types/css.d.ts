// `import "../global.css"` (src/app/_layout.tsx) için tip bildirimi.
// Eskiden bu bildirim yalnızca Expo'nun ürettiği, git'e girmeyen expo-env.d.ts'ten geliyordu; temiz bir
// kopyada (GitHub CI) bulunmadığı için "Tip denetimi" adımı TS2882 ile düşüyordu.
declare module "*.css";
