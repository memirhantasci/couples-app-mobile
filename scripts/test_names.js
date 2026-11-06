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
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  body {
    width: 1290px;
    height: 1400px;
    background: #000;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 40px;
  }

  .phone-box {
    position: relative;
    width: 580px;
    height: 1250px;
    background: #111;
    border-radius: 46px;
    overflow: hidden;
  }

  .phone-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  /* Overlay for Kadın: Zeynep */
  .overlay-kadin-greeting {
    position: absolute;
    top: 33px;
    left: 16px;
    width: 380px;
    height: 38px;
    background: #190913;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 50;
  }

  .overlay-kadin-greeting span.name {
    font-size: 26px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
  }

  .overlay-kadin-letter {
    position: absolute;
    top: 146px;
    left: 68px;
    width: 250px;
    height: 20px;
    background: #250f1d;
    display: flex;
    align-items: center;
    z-index: 50;
  }

  .overlay-kadin-letter span {
    font-size: 13.5px;
    font-weight: 500;
    color: #bfa3b3;
  }

  /* Overlay for Erkek: Yusuf */
  .overlay-erkek-greeting {
    position: absolute;
    top: 90px;
    left: 16px;
    width: 380px;
    height: 38px;
    background: #090e18;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 50;
  }

  .overlay-erkek-greeting span.name {
    font-size: 26px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
  }

  .overlay-erkek-letter {
    position: absolute;
    top: 215px;
    left: 68px;
    width: 250px;
    height: 20px;
    background: #111826;
    display: flex;
    align-items: center;
    z-index: 50;
  }

  .overlay-erkek-letter span {
    font-size: 13.5px;
    font-weight: 500;
    color: #9cb2cc;
  }
</style>
</head>
<body>

  <!-- Kadın Phone (Zeynep) -->
  <div class="phone-box">
    <div style="height: 62px; background: #1b0a14;"></div>
    <div style="height: 1188px; position: relative;">
      <img src="${fKadın}" />
      
      <!-- Greeting Patch -->
      <div class="overlay-kadin-greeting">
        <span class="name">Günaydın, Zeynep ❤️ ☀️</span>
      </div>

      <!-- Letter Patch -->
      <div class="overlay-kadin-letter">
        <span>Yusuf • 100 gün sonra</span>
      </div>
    </div>
  </div>

  <!-- Erkek Phone (Yusuf) -->
  <div class="phone-box">
    <img src="${fErkek}" />

    <!-- Greeting Patch -->
    <div class="overlay-erkek-greeting">
      <span class="name">Günaydın, Yusuf ☀️</span>
    </div>

    <!-- Letter Patch -->
    <div class="overlay-erkek-letter">
      <span>Zeynep ❤️ • 49 gün sonra</span>
    </div>
  </div>

</body>
</html>`;

const hFile = path.join(__dirname, 'test_name_patches.html');
fs.writeFileSync(hFile, html);
const oFile = path.join(__dirname, 'test_name_patches.png');
execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${oFile}" --window-size=1290,1400 "${hFile}"`);
console.log('Generated test_name_patches.png');
