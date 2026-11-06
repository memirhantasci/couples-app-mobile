const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function getB64(fp) {
  return 'data:image/jpeg;base64,' + fs.readFileSync(fp).toString('base64');
}

const fKadın = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\kadın\\IMG_9786.PNG');
const fYildiz = getB64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\IMG_9800.PNG');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1290px;
    height: 1400px;
    background: #0d0c16;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 50px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  }

  /* iPhone 17 Ultra-Slim Titanium Chassis */
  .iphone17 {
    position: relative;
    width: 580px;
    height: 1240px;
    background: #181920;
    border-radius: 56px;
    padding: 8px; /* Ultra-thin bezel */
    box-shadow: 
      0 0 0 2px #484b5c,
      0 0 0 4px #1c1d24,
      0 30px 80px rgba(0, 0, 0, 0.9),
      0 0 40px rgba(255, 75, 130, 0.15);
    display: flex;
    flex-direction: column;
  }

  .screen {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 48px;
    overflow: hidden;
    background: #000;
  }

  .screen img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* iPhone 17 Compact Pill (Dynamic Island) */
  .dynamic-island-17 {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 90px;
    height: 22px;
    background: #000000;
    border-radius: 12px;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .lens {
    width: 8px;
    height: 8px;
    background: radial-gradient(circle at 35% 35%, #1C2740 0%, #080B12 100%);
    border-radius: 50%;
  }

  .glass-sheen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.01) 40%, transparent 60%);
    pointer-events: none;
    z-index: 90;
  }
</style>
</head>
<body>

  <div class="iphone17">
    <div class="screen">
      <div class="dynamic-island-17">
        <div class="lens"></div>
      </div>
      <img src="${fKadın}" />
      <div class="glass-sheen"></div>
    </div>
  </div>

  <div class="iphone17">
    <div class="screen">
      <div class="dynamic-island-17">
        <div class="lens"></div>
      </div>
      <img src="${fYildiz}" />
      <div class="glass-sheen"></div>
    </div>
  </div>

</body>
</html>`;

const tmp = path.join(__dirname, 'test_iphone17.html');
fs.writeFileSync(tmp, html, 'utf8');
const out = path.join(__dirname, 'test_iphone17.png');
execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${out}" --window-size=1290,1400 "${tmp}"`);
console.log('Success generating test_iphone17.png');
fs.unlinkSync(tmp);

