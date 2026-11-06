const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getBase64(filePath) {
  const fileData = fs.readFileSync(filePath);
  return `data:image/png;base64,${fileData.toString('base64')}`;
}

const engFemale = getBase64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\eng\\kadın\\IMG_9780.PNG');
const engMale = getBase64('C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\eng\\erkek\\IMG_9781.PNG');

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    body {
      width: 1290px;
      height: 2796px;
      background: radial-gradient(circle at 50% 0%, #1e1933 0%, #0d0c16 55%, #050508 100%);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", "Helvetica Neue", Arial, sans-serif;
      color: #ffffff;
      overflow: hidden;
      position: relative;
    }

    /* Ambient Nebulae */
    .glow-left {
      position: absolute;
      top: 32%;
      left: -20%;
      width: 850px;
      height: 850px;
      background: radial-gradient(circle, rgba(255, 75, 130, 0.28) 0%, rgba(255, 75, 130, 0) 70%);
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
    }

    .glow-right {
      position: absolute;
      top: 36%;
      right: -20%;
      width: 850px;
      height: 850px;
      background: radial-gradient(circle, rgba(64, 135, 255, 0.28) 0%, rgba(64, 135, 255, 0) 70%);
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
    }

    /* Cosmic Background Particles */
    .star {
      position: absolute;
      background: #ffffff;
      border-radius: 50%;
      opacity: 0.7;
    }

    /* Header Section */
    .header {
      width: 100%;
      text-align: center;
      padding-top: 150px;
      padding-left: 70px;
      padding-right: 70px;
      z-index: 10;
      position: relative;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 16px 34px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 100px;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: #FFB3D9;
      margin-bottom: 34px;
      box-shadow: 0 4px 25px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(12px);
    }

    .title {
      font-size: 88px;
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -2px;
      margin-bottom: 24px;
      background: linear-gradient(180deg, #FFFFFF 0%, #D8DCF0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 38px;
      font-weight: 400;
      color: #9EA3B8;
      line-height: 1.45;
      max-width: 980px;
      margin: 0 auto;
    }

    /* Phones Showcase Stage */
    .stage {
      position: absolute;
      top: 670px;
      left: 0;
      width: 1290px;
      height: 2126px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    /* iPhone 16 / 17 Pro Chassis */
    .phone {
      position: absolute;
      width: 610px;
      height: 1290px;
      border-radius: 60px;
      background: #14151A;
      padding: 10px;
      box-shadow: 
        0 0 0 2px #484A54,
        0 0 0 5px #18191E,
        0 40px 100px rgba(0, 0, 0, 0.85);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .phone.left-phone {
      left: 55px;
      top: 90px;
      transform: rotate(-4.5deg);
      z-index: 3;
      box-shadow: 
        0 0 0 2.5px #7E5465,
        0 0 0 6px #221A1E,
        -15px 40px 100px rgba(255, 75, 130, 0.22),
        0 45px 110px rgba(0, 0, 0, 0.9);
    }

    .phone.right-phone {
      right: 55px;
      top: 145px;
      transform: rotate(4.5deg);
      z-index: 2;
      box-shadow: 
        0 0 0 2.5px #3F5E82,
        0 0 0 6px #161D24,
        15px 40px 100px rgba(64, 128, 255, 0.22),
        0 45px 110px rgba(0, 0, 0, 0.9);
    }

    /* Phone Screen Container */
    .screen-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50px;
      overflow: hidden;
      background: #000000;
    }

    /* Screen Image */
    .screen-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Dynamic Island */
    .dynamic-island {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      width: 150px;
      height: 40px;
      background: #000000;
      border-radius: 22px;
      z-index: 100;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 14px;
    }

    .camera-lens {
      width: 13px;
      height: 13px;
      background: radial-gradient(circle at 35% 35%, #1C2740 0%, #080B12 100%);
      border-radius: 50%;
      box-shadow: inset 0 0 2px rgba(255, 255, 255, 0.3);
    }

    /* Glass Sheen Reflection */
    .glass-sheen {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 65%);
      pointer-events: none;
      z-index: 99;
    }

    /* Floating Pill Labels for Phones */
    .phone-tag {
      position: absolute;
      bottom: 600px;
      padding: 16px 38px;
      border-radius: 100px;
      font-size: 28px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      backdrop-filter: blur(25px);
      z-index: 20;
      box-shadow: 0 12px 35px rgba(0,0,0,0.6);
    }

    .phone-tag.tag-left {
      left: 175px;
      background: rgba(255, 107, 143, 0.22);
      border: 1.5px solid rgba(255, 107, 143, 0.5);
      color: #FFB8CF;
    }

    .phone-tag.tag-right {
      right: 175px;
      background: rgba(84, 153, 255, 0.22);
      border: 1.5px solid rgba(84, 153, 255, 0.5);
      color: #B5D5FF;
    }

    /* Bottom Trust Proof Bar */
    .bottom-bar {
      position: absolute;
      bottom: 120px;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 48px;
      font-size: 24px;
      color: #8C91A8;
      font-weight: 500;
      letter-spacing: 1px;
    }

    .bottom-bar span {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  </style>
</head>
<body>

  <div class="glow-left"></div>
  <div class="glow-right"></div>

  <!-- Ambient Stars -->
  <div class="star" style="top: 80px; left: 140px; width: 4px; height: 4px;"></div>
  <div class="star" style="top: 220px; right: 200px; width: 6px; height: 6px; opacity: 0.9;"></div>
  <div class="star" style="top: 480px; left: 90px; width: 5px; height: 5px;"></div>
  <div class="star" style="top: 600px; right: 110px; width: 4px; height: 4px;"></div>
  <div class="star" style="top: 900px; left: 50px; width: 5px; height: 5px; opacity: 0.9;"></div>
  <div class="star" style="top: 1100px; right: 70px; width: 4px; height: 4px;"></div>
  <div class="star" style="top: 2400px; left: 160px; width: 5px; height: 5px;"></div>
  <div class="star" style="top: 2500px; right: 180px; width: 6px; height: 6px; opacity: 0.85;"></div>

  <div class="header">
    <div class="badge">✨ #1 Private Space for Couples</div>
    <h1 class="title">Two Hearts,<br>One Shared Universe</h1>
    <p class="subtitle">Personalized dual themes, real-time sync, countdowns & emotional check-ins.</p>
  </div>

  <div class="stage">
    <!-- Left Phone (Emma - Pink Theme) -->
    <div class="phone left-phone">
      <div class="screen-wrapper">
        <div class="dynamic-island">
          <div class="camera-lens"></div>
        </div>
        <img class="screen-img" src="${engFemale}" alt="Emma Theme" />
        <div class="glass-sheen"></div>
      </div>
    </div>

    <!-- Right Phone (Liam - Blue Theme) -->
    <div class="phone right-phone">
      <div class="screen-wrapper">
        <div class="dynamic-island">
          <div class="camera-lens"></div>
        </div>
        <img class="screen-img" src="${engMale}" alt="Liam Theme" />
        <div class="glass-sheen"></div>
      </div>
    </div>

    <!-- Partner Tags -->
    <div class="phone-tag tag-left">
      <span>Her View 💕</span>
    </div>
    <div class="phone-tag tag-right">
      <span>His View 💙</span>
    </div>
  </div>

  <div class="bottom-bar">
    <span>🔒 End-to-End Encrypted</span>
    <span>•</span>
    <span>⚡ Instant Cloud Sync</span>
    <span>•</span>
    <span>🪐 3D Celestial Dome</span>
  </div>

</body>
</html>
`;

const tempHtml = path.join(__dirname, 'temp_mockup_eng.html');
fs.writeFileSync(tempHtml, htmlContent, 'utf8');

const outputPng = 'C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\eng\\01_DuoPhones_Showcase_ENG.png';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Rendering refined App Store screenshot with Edge...');
execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${outputPng}" --window-size=1290,2796 "${tempHtml}"`);

console.log('Done! Generated:', outputPng);
fs.unlinkSync(tempHtml);
