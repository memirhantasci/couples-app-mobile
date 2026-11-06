const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function getB64(fp) {
  return 'data:image/jpeg;base64,' + fs.readFileSync(fp).toString('base64');
}

const fKadın = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\kadın\\IMG_9786.PNG');
const fErkek = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\erkek\\tr_male_home.jpg');

const html = `<!DOCTYPE html>
<html>
<body style="margin:0;background:#111;color:#fff;font-family:sans-serif;padding:20px;">
  <h2>Kadın (IMG_9786) Top 500px:</h2>
  <div style="position:relative;width:600px;height:350px;overflow:hidden;border:2px solid pink;">
    <img src="${fKadın}" style="width:600px;position:absolute;top:0;left:0;" />
  </div>

  <h2>Erkek (tr_male_home) Top 500px:</h2>
  <div style="position:relative;width:600px;height:350px;overflow:hidden;border:2px solid cyan;">
    <img src="${fErkek}" style="width:600px;position:absolute;top:0;left:0;" />
  </div>
</body>
</html>`;

const hFile = path.join(__dirname, 'inspect_headers.html');
fs.writeFileSync(hFile, html);
const oFile = path.join(__dirname, 'inspect_headers.png');
execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${oFile}" --window-size=650,800 "${hFile}"`);
console.log('Generated inspect_headers.png');

