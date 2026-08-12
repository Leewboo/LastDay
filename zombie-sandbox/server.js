const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 检查自定义资源目录
const ASSETS_DIR = path.join(__dirname, 'public', 'assets');
const SPRITES_DIR = path.join(ASSETS_DIR, 'sprites');

// API: 列出可用的精灵资源（如果用户放入了真实素材）
app.get('/api/assets', (req, res) => {
  const sprites = {};
  const categories = ['survivor_male', 'survivor_female', 'zombie_normal', 'zombie_fast', 'zombie_tank'];
  categories.forEach(cat => {
    const dir = path.join(SPRITES_DIR, cat);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
      if (files.length > 0) sprites[cat] = files.map(f => `/assets/sprites/${cat}/${f}`);
    }
  });
  res.json({ sprites, customAssetsAvailable: Object.keys(sprites).length > 0 });
});

// API: 资源放置说明
app.get('/api/assets-help', (req, res) => {
  res.json({
    message: '将下载的丧尸游戏资源.zip解压后，按以下目录结构放入 public/assets/sprites/ 即可替换为真实素材',
    structure: {
      'survivor_male/': '男幸存者精灵图 (png/jpg)',
      'survivor_female/': '女幸存者精灵图 (png/jpg)',
      'zombie_normal/': '普通丧尸精灵图 (png/jpg)',
      'zombie_fast/': '快速丧尸精灵图 (png/jpg)',
      'zombie_tank/': '坦克丧尸精灵图 (png/jpg)'
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║  🧟  丧尸沙盒游戏已启动！                             ║
  ║                                                       ║
  ║  🌐 访问地址: http://localhost:${PORT}                  ║
  ║                                                       ║
  ║  📂 如需使用真实素材:                                 ║
  ║     1. 下载并解压 丧尸游戏资源.zip                    ║
  ║     2. 按目录放入 zombie-sandbox/public/assets/sprites/ ║
  ║     3. 刷新页面即可加载真实精灵图                     ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});
