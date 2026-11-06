const fs = require('fs');
const path = require('path');

const imgPath = 'C:\\Users\\emirh\\Desktop\\mağaza-fotoları\\tr\\kadın\\IMG_9786.PNG';
const b64 = 'data:image/jpeg;base64,' + fs.readFileSync(imgPath).toString('base64');

const html = `<!DOCTYPE html>
<html>
<body style="background:#111;color:#fff;margin:0;padding:20px;font-family:sans-serif;">
  <h3>Top 400px of IMG_9786.PNG:</h3>
  <div style="position:relative;width:600px;height:400px;overflow:hidden;border:2px solid cyan;">
    <img src="${b64}" style="width:600px;position:absolute;top:0;left:0;" />
    <!-- Dynamic island overlay test -->
    <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);width:130px;height:32px;background:#000;border-radius:16px;border:1px solid #333;z-index:10;display:flex;align-items:center;justify-content:center;color:#666;font-size:10px;">
      Island
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'debug_top.html'), html);
console.log('Saved debug_top.html');

