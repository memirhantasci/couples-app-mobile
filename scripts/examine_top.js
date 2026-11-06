const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function getB64(fp) {
  return 'data:image/jpeg;base64,' + fs.readFileSync(fp).toString('base64');
}

const f1 = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\kadın\\IMG_9786.PNG');
const f2 = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\erkek\\IMG_9797.PNG');
const f3 = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\IMG_9799.PNG');
const f4 = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\IMG_9800.PNG');

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { background: #222; color: #fff; font-family: monospace; padding: 20px; }
  .row { display: flex; gap: 20px; margin-bottom: 20px; }
  .box { position: relative; width: 300px; height: 200px; overflow: hidden; border: 2px solid yellow; background: #000; }
  .box img { width: 300px; position: absolute; top: 0; left: 0; }
  /* test island */
  .island { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 75px; height: 18px; background: #000; border-radius: 10px; z-index: 10; border: 1px solid #444; }
</style>
</head>
<body>
  <h2>Top of Screens</h2>
  <div class="row">
    <div>
      <div>Kadın Home (IMG_9786)</div>
      <div class="box"><div class="island"></div><img src="${f1}" /></div>
    </div>
    <div>
      <div>Erkek Takvim (IMG_9797)</div>
      <div class="box"><div class="island"></div><img src="${f2}" /></div>
    </div>
    <div>
      <div>Yıldız Gökyüzü (IMG_9799)</div>
      <div class="box"><div class="island"></div><img src="${f3}" /></div>
    </div>
    <div>
      <div>Yıldız Kalbi (IMG_9800)</div>
      <div class="box"><div class="island"></div><img src="${f4}" /></div>
    </div>
  </div>
</body>
</html>`;

const htmlPath = path.join(__dirname, 'top_test.html');
fs.writeFileSync(htmlPath, html, 'utf8');
const outPng = path.join(__dirname, 'top_test.png');
execSync(`"${edgePath}" --headless --screenshot="${outPng}" --window-size=1300,400 "${htmlPath}"`);
console.log('Generated top_test.png');
fs.unlinkSync(htmlPath);

