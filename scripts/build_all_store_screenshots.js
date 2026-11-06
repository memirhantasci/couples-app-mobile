const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const basePhotosDir = 'C:\\Users\\emirh\\Desktop\\mağaza-fotoları';

function getBase64(relPath) {
  const full = path.join(basePhotosDir, relPath);
  if (!fs.existsSync(full)) {
    throw new Error('File not found: ' + full);
  }
  const ext = path.extname(full).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
}

// Render an authentic iPhone 17 Pro 3D Chassis with Floating Dynamic Island
function renderIPhone17({ imgSrc, isUncropped = false, tagText = '', statusBg = '#0b0c16', time = '07:00' }) {
  const contentHtml = isUncropped
    ? `<img class="uncropped-img" src="${imgSrc}" />`
    : `
      <div class="cropped-content">
        <div class="custom-status-bar" style="background: ${statusBg};">
          <div class="status-time">${time}</div>
          <div class="status-right">
            <svg width="18" height="11" viewBox="0 0 24 14" fill="#ffffff">
              <path d="M1 9.5a1 1 0 011-1h2a1 1 0 011 1v3.5a1 1 0 01-1 1H2a1 1 0 01-1-1V9.5zm6-3a1 1 0 011-1h2a1 1 0 011 1v6.5a1 1 0 01-1 1H8a1 1 0 01-1-1V6.5zm6-3a1 1 0 011-1h2a1 1 0 011 1v9.5a1 1 0 01-1 1h-2a1 1 0 01-1-1V3.5zm6-3a1 1 0 011-1h2a1 1 0 011 1v12.5a1 1 0 01-1 1h-2a1 1 0 01-1-1V.5z"/>
            </svg>
            <svg width="15" height="11" viewBox="0 0 16 12" fill="#ffffff">
              <path d="M8 2.8C5.2 2.8 2.7 3.9.8 5.7c-.3.3-.3.8 0 1.1l1.1 1.1c.3.3.8.3 1.1 0C4.3 6.6 6 5.9 8 5.9s3.7.7 5 2c.3.3.8.3 1.1 0l1.1-1.1c.3-.3.3-.8 0-1.1C13.3 3.9 10.8 2.8 8 2.8zm0 5.2c-1.3 0-2.4.5-3.3 1.4-.3.3-.3.8 0 1.1l2.7 2.7c.3.3.8.3 1.1 0l2.7-2.7c.3-.3.3-.8 0-1.1C10.4 8.5 9.3 8 8 8z"/>
            </svg>
            <div class="battery-pill">
              <div class="battery-level"></div>
            </div>
          </div>
        </div>
        <div class="img-box">
          <img src="${imgSrc}" />
        </div>
      </div>
    `;

  return `
    <div class="phone-outer">
      <div class="button-power"></div>
      <div class="button-action"></div>
      <div class="button-volup"></div>
      <div class="button-voldn"></div>

      <div class="screen-glass">
        <!-- Floating Dynamic Island -->
        <div class="dynamic-island">
          <div class="camera"></div>
        </div>

        ${contentHtml}

        <div class="glass-reflection"></div>
      </div>
      ${tagText ? `<div class="phone-tag"><span>${tagText}</span></div>` : ''}
    </div>
  `;
}

function generateMockupHtml({
  badge,
  title,
  subtitle,
  phones = [],
  footerItems = [],
  glowTheme = 'duo'
}) {
  let glowLeft = 'rgba(255, 75, 130, 0.28)';
  let glowRight = 'rgba(64, 135, 255, 0.28)';
  if (glowTheme === 'star') {
    glowLeft = 'rgba(168, 85, 247, 0.35)';
    glowRight = 'rgba(244, 114, 182, 0.30)';
  } else if (glowTheme === 'purple') {
    glowLeft = 'rgba(168, 85, 247, 0.30)';
    glowRight = 'rgba(236, 72, 153, 0.25)';
  } else if (glowTheme === 'blue') {
    glowLeft = 'rgba(56, 189, 248, 0.28)';
    glowRight = 'rgba(99, 102, 241, 0.28)';
  } else if (glowTheme === 'pink') {
    glowLeft = 'rgba(255, 75, 130, 0.32)';
    glowRight = 'rgba(244, 114, 182, 0.25)';
  }

  const phonesHtml = phones.map(p => renderIPhone17(p)).join('\n');

  return `<!DOCTYPE html>
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
      background: radial-gradient(circle at 50% 0%, #1c1830 0%, #0c0b16 55%, #050508 100%);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", "Helvetica Neue", Arial, sans-serif;
      color: #ffffff;
      overflow: hidden;
      position: relative;
    }

    /* Ambient Nebulae */
    .glow-left {
      position: absolute;
      top: 32%;
      left: -18%;
      width: 950px;
      height: 950px;
      background: radial-gradient(circle, ${glowLeft} 0%, rgba(0,0,0,0) 70%);
      border-radius: 50%;
      filter: blur(100px);
      pointer-events: none;
    }

    .glow-right {
      position: absolute;
      top: 36%;
      right: -18%;
      width: 950px;
      height: 950px;
      background: radial-gradient(circle, ${glowRight} 0%, rgba(0,0,0,0) 70%);
      border-radius: 50%;
      filter: blur(100px);
      pointer-events: none;
    }

    .star {
      position: absolute;
      background: #ffffff;
      border-radius: 50%;
      opacity: 0.65;
    }

    /* Header */
    .header {
      width: 100%;
      text-align: center;
      padding-top: 130px;
      padding-left: 70px;
      padding-right: 70px;
      z-index: 10;
      position: relative;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 16px 36px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.20);
      border-radius: 100px;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #FFB8D9;
      margin-bottom: 28px;
      box-shadow: 0 4px 25px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(12px);
    }

    .title {
      font-size: 86px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -2px;
      margin-bottom: 22px;
      background: linear-gradient(180deg, #FFFFFF 0%, #DADEF2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 38px;
      font-weight: 400;
      color: #9FA4B8;
      line-height: 1.45;
      max-width: 980px;
      margin: 0 auto;
    }

    /* Stage: Upright Side-by-Side Dual iPhone 17 */
    .stage {
      position: absolute;
      top: 670px;
      left: 0;
      width: 1290px;
      height: 2126px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 36px;
    }

    /* Ultra-Realistic iPhone 17 Titanium 3D Chassis */
    .phone-outer {
      position: relative;
      width: 580px;
      height: 1250px;
      background: linear-gradient(135deg, #6c6f80 0%, #343744 40%, #1e2028 100%);
      border-radius: 56px;
      padding: 10px;
      box-sizing: border-box;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.25) inset,
        0 0 0 2px #101115,
        0 35px 90px rgba(0, 0, 0, 0.88),
        0 0 50px rgba(255, 75, 130, 0.15);
      display: flex;
      flex-direction: column;
    }

    /* Physical Side Buttons */
    .button-power {
      position: absolute;
      right: -4px;
      top: 240px;
      width: 4px;
      height: 80px;
      background: linear-gradient(180deg, #5a5d6e, #2d2f3a);
      border-radius: 0 3px 3px 0;
    }

    .button-action {
      position: absolute;
      left: -4px;
      top: 170px;
      width: 4px;
      height: 40px;
      background: linear-gradient(180deg, #5a5d6e, #2d2f3a);
      border-radius: 3px 0 0 3px;
    }

    .button-volup {
      position: absolute;
      left: -4px;
      top: 230px;
      width: 4px;
      height: 65px;
      background: linear-gradient(180deg, #5a5d6e, #2d2f3a);
      border-radius: 3px 0 0 3px;
    }

    .button-voldn {
      position: absolute;
      left: -4px;
      top: 310px;
      width: 4px;
      height: 65px;
      background: linear-gradient(180deg, #5a5d6e, #2d2f3a);
      border-radius: 3px 0 0 3px;
    }

    /* Screen Glass */
    .screen-glass {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 46px;
      overflow: hidden;
      background: #000000;
      display: flex;
      flex-direction: column;
    }

    /* Real Apple Dynamic Island */
    .dynamic-island {
      position: absolute;
      top: 13px;
      left: 50%;
      transform: translateX(-50%);
      width: 125px;
      height: 35px;
      background: #000000;
      border-radius: 20px;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 12px;
      box-shadow: 0 0 2px rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.85);
    }

    .dynamic-island .camera {
      width: 11px;
      height: 11px;
      background: radial-gradient(circle at 35% 35%, #243552 0%, #070a10 100%);
      border-radius: 50%;
      box-shadow: inset 0 0 2px rgba(255,255,255,0.4);
    }

    /* Cropped Screenshot Top Padding & Status Bar */
    .cropped-content {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .custom-status-bar {
      width: 100%;
      height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      position: relative;
      z-index: 10;
      flex-shrink: 0;
    }

    .status-time {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
      width: 50px;
      letter-spacing: -0.2px;
    }

    .status-right {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 60px;
      justify-content: flex-end;
    }

    .battery-pill {
      width: 22px;
      height: 11px;
      border: 1.5px solid #ffffff;
      border-radius: 3px;
      padding: 1px;
      position: relative;
      display: flex;
      align-items: center;
    }

    .battery-pill::after {
      content: '';
      position: absolute;
      right: -3px;
      top: 2.5px;
      width: 2px;
      height: 4px;
      background: #ffffff;
      border-radius: 0 1px 1px 0;
    }

    .battery-level {
      width: 100%;
      height: 100%;
      background: #ffffff;
      border-radius: 1px;
    }

    .cropped-content .img-box {
      flex: 1;
      width: 100%;
      overflow: hidden;
    }

    .cropped-content .img-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }

    /* Uncropped Screenshot */
    .uncropped-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }

    /* Glass Sheen */
    .glass-reflection {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.01) 40%, transparent 60%);
      pointer-events: none;
      z-index: 900;
    }

    /* Floating Pill Tags */
    .phone-tag {
      position: absolute;
      bottom: -65px;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 34px;
      border-radius: 100px;
      font-size: 26px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      backdrop-filter: blur(25px);
      z-index: 20;
      box-shadow: 0 12px 35px rgba(0,0,0,0.65);
      white-space: nowrap;
      background: rgba(255, 255, 255, 0.10);
      border: 1.5px solid rgba(255, 255, 255, 0.35);
      color: #FFFFFF;
    }

    /* Bottom Trust Bar */
    .bottom-bar {
      position: absolute;
      bottom: 110px;
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

  <div class="star" style="top: 80px; left: 140px; width: 4px; height: 4px;"></div>
  <div class="star" style="top: 220px; right: 200px; width: 6px; height: 6px; opacity: 0.9;"></div>
  <div class="star" style="top: 480px; left: 90px; width: 5px; height: 5px;"></div>
  <div class="star" style="top: 600px; right: 110px; width: 4px; height: 4px;"></div>
  <div class="star" style="top: 900px; left: 50px; width: 5px; height: 5px;"></div>
  <div class="star" style="top: 1100px; right: 70px; width: 4px; height: 4px;"></div>

  <div class="header">
    <div class="badge">${badge}</div>
    <h1 class="title">${title}</h1>
    <p class="subtitle">${subtitle}</p>
  </div>

  <div class="stage">
    ${phonesHtml}
  </div>

  <div class="bottom-bar">
    ${footerItems.map((item, idx) => `<span>${item}</span>${idx < footerItems.length - 1 ? '<span>•</span>' : ''}`).join('')}
  </div>

</body>
</html>`;
}

// 6 Duo-Phone Showcase Slides with Real Dynamic Island (Dinamik Ada)
const trSlides = [
  {
    fileName: '01_AnaSayfa_CiftTemasi_TR.png',
    badge: '✨ Çiftler İçin 1 Numaralı Özel Alan',
    title: 'İki Kalp,<br>Ortak Bir Evren',
    subtitle: 'Kişiselleştirilmiş çift temaları, ilişki sayacı ve gerçek zamanlı duygusal bağ.',
    glowTheme: 'duo',
    phones: [
      {
        imgSrc: getBase64('tr/kadın/IMG_9786.PNG'),
        isUncropped: false,
        tagText: 'Kadın Teması 💕',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('tr/erkek/tr_male_home.jpg'),
        isUncropped: true, // Uses user's original uncropped photo with native status bar
        tagText: 'Erkek Teması 💙',
        statusBg: '#0b111e'
      }
    ],
    footerItems: ['🔒 Uçtan Uca Şifreli', '⚡ Anlık Bulut Senkronizasyonu', '🪐 3D Gökyüzü Kubbesi']
  },
  {
    fileName: '02_BizimYildizimiz_3D_Uzay_TR.png',
    badge: '🪐 BİZİM YILDIZIMIZ & 3D GÖKYÜZÜ',
    title: 'Gökyüzünde Sadece<br>Size Özel Bir Yıldız',
    subtitle: 'Yıldızınızı gökyüzünde bulun, dokunarak anlık titreşim gönderin ve anılarınızı yaşatın.',
    glowTheme: 'star',
    phones: [
      {
        imgSrc: getBase64('tr/IMG_9799.PNG'),
        isUncropped: false,
        tagText: 'Gökyüzü Radarı 🌌',
        statusBg: '#050711'
      },
      {
        imgSrc: getBase64('tr/IMG_9800.PNG'),
        isUncropped: false,
        tagText: 'Yıldızımızın Kalbi 💫',
        statusBg: '#06070e'
      }
    ],
    footerItems: ['🪐 3D Gezegenler & Anılar', '💫 Dokununca Anlık Titreşim', '🌌 Gerçek Yıldız Koordinatları']
  },
  {
    fileName: '03_Mektuplar_Bulusmalar_TR.png',
    badge: '💌 ZAMAN KAPSÜLÜ & BULUŞMALAR',
    title: 'Mühürlü Mektuplar &<br>Özel Randevular',
    subtitle: 'Gelecekte açılacak mektuplar bırakın, haritadan konum belirleyerek buluşmalar planlayın.',
    glowTheme: 'pink',
    phones: [
      {
        imgSrc: getBase64('tr/kadın/IMG_9789.PNG'),
        isUncropped: false,
        tagText: 'Mühürlü Aşk Kapsülü 🗝️',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('tr/erkek/IMG_9798.PNG'),
        isUncropped: false,
        tagText: 'Romantik Randevu Planı 📍',
        statusBg: '#0b111e'
      }
    ],
    footerItems: ['🔒 Zaman Kilitli Mesajlar', '📍 Haritada Buluşma Noktası', '🔔 Özel Gün Bildirimleri']
  },
  {
    fileName: '04_AskTakvimi_OzelGunluk_TR.png',
    badge: '📅 AŞK TAKVİMİ & ÖZEL GÜNLÜK',
    title: 'Özel Günleriniz ve<br>Gizli Notlarınız',
    subtitle: 'Önemli yıldönümlerini ortak takip edin, partnerinize özel hislerinizi günlüğe dökün.',
    glowTheme: 'duo',
    phones: [
      {
        imgSrc: getBase64('tr/kadın/IMG_9790.PNG'),
        isUncropped: false,
        tagText: 'Ortak Aşk Takvimi 🗓️',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('tr/erkek/IMG_9795.PNG'),
        isUncropped: false,
        tagText: 'Sana Özel Günlük ✍️',
        statusBg: '#0b111e'
      }
    ],
    footerItems: ['🔐 Biyometrik Kilit', '📅 Hatıra & Etkinlik Takvimi', '🌟 Duygu Durumu']
  },
  {
    fileName: '05_AskHaritasi_OrtakGaleri_TR.png',
    badge: '🗺️ AŞK ROTAMIZ & ANILAR',
    title: 'Gezdiğiniz Şehirler,<br>Ölümsüz Hatıralar',
    subtitle: 'Birlikte ayak bastığınız her noktayı fotoğraflar ve özel notlarla haritada ölümsüzleştirin.',
    glowTheme: 'blue',
    phones: [
      {
        imgSrc: getBase64('tr/IMG_9785.PNG'),
        isUncropped: false,
        tagText: 'Aşk Rotamız 🌍',
        statusBg: '#0e1220'
      },
      {
        imgSrc: getBase64('tr/IMG_9787.PNG'),
        isUncropped: false,
        tagText: 'Ortak Fotoğraf Galerisi 📸',
        statusBg: '#0a0b12'
      }
    ],
    footerItems: ['📌 Şehir & Konum Pinleri', '📸 Yüksek Çözünürlüklü Galeri', '✈️ Seyahat Rotası']
  },
  {
    fileName: '06_SaglikTakibi_Dongu_Ilac_TR.png',
    badge: '🌸 SEVGİYLE SAĞLIK TAKİBİ',
    title: 'Döngü & İlaçlarınızı<br>Birlikte Takip Edin',
    subtitle: 'Döngü takvimi ve günlük karşılıklı ilaç hatırlatıcılarıyla partnerinizin her an yanındasınız.',
    glowTheme: 'pink',
    phones: [
      {
        imgSrc: getBase64('tr/kadın/IMG_9793.PNG'),
        isUncropped: false,
        tagText: 'Döngü & Regl Takvimi 🌸',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('tr/kadın/IMG_9792.PNG'),
        isUncropped: false,
        tagText: 'Karşılıklı İlaç Desteği 💊',
        statusBg: '#120b17'
      }
    ],
    footerItems: ['🩸 Akıllı Döngü Tahmini', '💊 Çiftler İçin İlaç Takibi', '⏰ Nazik Hatırlatıcılar']
  }
];

const engSlides = [
  {
    fileName: '01_HomeScreen_DualThemes_ENG.png',
    badge: '✨ #1 Private Space for Couples',
    title: 'Two Hearts,<br>One Shared Universe',
    subtitle: 'Personalized dual themes, real-time sync, countdowns & emotional check-ins.',
    glowTheme: 'duo',
    phones: [
      {
        imgSrc: getBase64('eng/kadın/IMG_9780.PNG'),
        isUncropped: false,
        tagText: 'Her View 💕',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('eng/erkek/IMG_9781.PNG'),
        isUncropped: false,
        tagText: 'His View 💙',
        statusBg: '#0b111e'
      }
    ],
    footerItems: ['🔒 End-to-End Encrypted', '⚡ Instant Cloud Sync', '🪐 3D Celestial Dome']
  },
  {
    fileName: '02_OurStar_3D_Galaxy_ENG.png',
    badge: '🪐 OUR CELESTIAL STAR & 3D SPACE',
    title: 'Your Dedicated Star<br>In The Night Sky',
    subtitle: 'Locate your star via true sky coordinates, touch to send heartbeat vibrations, and orbit memories.',
    glowTheme: 'star',
    phones: [
      {
        imgSrc: getBase64('eng/IMG_9767.JPG.jpeg'),
        isUncropped: false,
        tagText: 'Sky Radar View 🌌',
        statusBg: '#050711'
      },
      {
        imgSrc: getBase64('eng/IMG_9768.PNG'),
        isUncropped: false,
        tagText: 'Heart of Our Star 💫',
        statusBg: '#06070e'
      }
    ],
    footerItems: ['🪐 3D Memory Planets', '💫 Haptic Heartbeat Touch', '🌌 True Celestial Coordinates']
  },
  {
    fileName: '03_Letters_Meetups_ENG.png',
    badge: '💌 TIME CAPSULE & MEETUPS',
    title: 'Sealed Love Letters &<br>Romantic Meetups',
    subtitle: 'Leave time-locked letters for future dates, and plan unforgettable romantic dates on the map.',
    glowTheme: 'pink',
    phones: [
      {
        imgSrc: getBase64('eng/kadın/IMG_9774.PNG'),
        isUncropped: false,
        tagText: 'Sealed Time Capsule 🗝️',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('eng/kadın/IMG_9776.PNG'),
        isUncropped: false,
        tagText: 'Romantic Date Plans 📍',
        statusBg: '#0b111e'
      }
    ],
    footerItems: ['🔒 Time-Locked Letters', '📍 Interactive Date Map', '🔔 Special Moment Alerts']
  },
  {
    fileName: '04_LoveCalendar_PrivateJournal_ENG.png',
    badge: '📅 LOVE CALENDAR & PRIVATE JOURNAL',
    title: 'Special Milestones &<br>Private Secret Notes',
    subtitle: 'Track special anniversaries together while enjoying a deeply personal private diary.',
    glowTheme: 'duo',
    phones: [
      {
        imgSrc: getBase64('eng/kadın/IMG_9775.PNG'),
        isUncropped: false,
        tagText: 'Shared Calendar 🗓️',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('eng/erkek/IMG_9782.PNG'),
        isUncropped: false,
        tagText: 'Private Diary ✍️',
        statusBg: '#0b111e'
      }
    ],
    footerItems: ['🔐 Biometric Lock', '📅 Relationship Timeline', '🌟 Mood Insights']
  },
  {
    fileName: '05_LoveMap_SharedGallery_ENG.png',
    badge: '🗺️ OUR LOVE ROUTE & MEMORIES',
    title: 'Every City You Visit,<br>Every Shared Memory',
    subtitle: 'Pin the romantic places you have visited with photos, notes, and route traces.',
    glowTheme: 'blue',
    phones: [
      {
        imgSrc: getBase64('eng/IMG_9779.PNG'),
        isUncropped: false,
        tagText: 'Our Love Map 🌍',
        statusBg: '#0e1220'
      },
      {
        imgSrc: getBase64('eng/IMG_9773.PNG'),
        isUncropped: false,
        tagText: 'Shared Photo Gallery 📸',
        statusBg: '#0a0b12'
      }
    ],
    footerItems: ['📌 Location Pins', '📸 High-Res Photo Gallery', '✈️ Travel Milestones']
  },
  {
    fileName: '06_CaringHealth_Cycle_Meds_ENG.png',
    badge: '🌸 CARING HEALTH TRACKER',
    title: 'Support Each Other<br>With Health & Habits',
    subtitle: 'Smart menstrual cycle predictions and daily medication reminders for both partners.',
    glowTheme: 'pink',
    phones: [
      {
        imgSrc: getBase64('eng/kadın/IMG_9778.PNG'),
        isUncropped: false,
        tagText: 'Cycle & Period Tracker 🌸',
        statusBg: '#1b0a14'
      },
      {
        imgSrc: getBase64('eng/kadın/IMG_9777.PNG'),
        isUncropped: false,
        tagText: 'Daily Medicine Streak 💊',
        statusBg: '#120b17'
      }
    ],
    footerItems: ['🩸 Period Prediction', '💊 Mutual Med Care', '⏰ Gentle Reminders']
  }
];

function buildSet(lang, slides) {
  const outputDir = path.join(basePhotosDir, lang, 'store_showcase_final');
  if (fs.existsSync(outputDir)) {
    fs.readdirSync(outputDir).forEach(f => {
      fs.unlinkSync(path.join(outputDir, f));
    });
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\n========================================`);
  console.log(`Building ${lang.toUpperCase()} Dynamic Island Showcase (${slides.length} slides)...`);
  console.log(`Target folder: ${outputDir}`);
  console.log(`========================================`);

  slides.forEach((slide, idx) => {
    const html = generateMockupHtml(slide);
    const tmpHtml = path.join(__dirname, `temp_${lang}_${idx}.html`);
    fs.writeFileSync(tmpHtml, html, 'utf8');

    const outPng = path.join(outputDir, slide.fileName);
    console.log(`[${idx + 1}/${slides.length}] Generating: ${slide.fileName}...`);
    try {
      execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${outPng}" --window-size=1290,2796 "${tmpHtml}"`);
      console.log(`  -> OK: ${outPng}`);
    } catch (e) {
      console.error(`  -> Failed for ${slide.fileName}:`, e.message);
    } finally {
      if (fs.existsSync(tmpHtml)) {
        fs.unlinkSync(tmpHtml);
      }
    }
  });
}

buildSet('tr', trSlides);
buildSet('eng', engSlides);
console.log('\nAll 12 Dynamic Island store showcase screenshots rendered successfully!');
