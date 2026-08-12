const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// === 缓存策略中间件 ===
// vendor/phaser.min.js 是跟随package.json版本固定的,设置长缓存(7天)
// 其他静态资源(html/js/game assets)设置短缓存或禁用缓存以便开发
function cacheStrategy(req, res, next) {
  const url = req.url || '';
  if (/\/vendor\/phaser(\.min)?\.js(\?|#|$)/.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7天
  } else if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1天
  } else if (
    /\/js\/game\.js(\?|#|$)/.test(url) ||
    /\/index\.html?$/.test(url) ||
    url === '/' || url === ''
  ) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
}

app.use(cacheStrategy);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 检查自定义资源目录
const ASSETS_DIR = path.join(__dirname, 'public', 'assets');
const SPRITES_DIR = path.join(ASSETS_DIR, 'sprites');

// 确保 vendor 目录存在 (启动时自动复制 node_modules/phaser 到 public/vendor)
(function ensureVendor() {
  const vendorDir = path.join(__dirname, 'public', 'vendor');
  try {
    if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir, { recursive: true });
    const src = path.join(__dirname, 'node_modules', 'phaser', 'dist', 'phaser.min.js');
    const dst = path.join(vendorDir, 'phaser.min.js');
    if (fs.existsSync(src)) {
      const copyIfNeeded = () => {
        const srcStat = fs.statSync(src);
        if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); return; }
        const dstStat = fs.statSync(dst);
        if (srcStat.size !== dstStat.size || srcStat.mtimeMs > dstStat.mtimeMs) {
          fs.copyFileSync(src, dst);
        }
      };
      copyIfNeeded();
    }
  } catch (e) {
    console.warn('[warn] vendor setup skipped:', e.message);
  }
})();

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

// 健康检查
app.get('/healthz', (req, res) => {
  const vendorExists = fs.existsSync(path.join(__dirname, 'public', 'vendor', 'phaser.min.js'));
  res.json({
    ok: true,
    vendor: vendorExists ? 'ready' : 'missing',
    vendorSize: vendorExists ? fs.statSync(path.join(__dirname, 'public', 'vendor', 'phaser.min.js')).size : 0,
    cdnFallback: 'configured (local -> jsdelivr -> unpkg -> cdnjs)'
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║  🧟  丧尸沙盒游戏已启动！                             ║
  ║                                                       ║
  ║  🌐 访问地址: http://localhost:${PORT}                  ║
  ║                                                       ║
  ║  ⚡ CDN 优化策略:                                      ║
  ║     1. 优先加载本地 vendor/phaser.min.js (1.2MB)      ║
  ║     2. 失败自动 fallback: jsdelivr → unpkg → cdnjs    ║
  ║     3. 本地 phaser 设置 7 天长缓存                    ║
  ║                                                       ║
  ║  📱 手机端操作:                                        ║
  ║     • 点击 [↻ LANDSCAPE] 一键横屏+全屏                ║
  ║     • iOS Safari: 自动 CSS 旋转 fallback              ║
  ║     • 点击角色按钮 → 屏幕任意处放置                   ║
  ║                                                       ║
  ║  📂 如需使用真实素材:                                 ║
  ║     1. 下载并解压 丧尸游戏资源.zip                    ║
  ║     2. 按目录放入 zombie-sandbox/public/assets/sprites/ ║
  ║     3. 刷新页面即可加载真实精灵图                     ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});
