// ============================================================
//  Zombie Sandbox Game  |  Phaser 3.80  |  2D 横版 + 移动端适配
// ============================================================

// ---------- 配色 ----------
const PALETTE = {
  green: 0x22c55e, greenDark: 0x15803d, greenDarker: 0x0f5c2b,
  red: 0xef4444, redDark: 0x991b1b, redDarker: 0x6b0f10,
  skin: 0xe5c5a5, skinZ: 0x8a7a6a,
  black: 0x0a0a0a, black2: 0x141414,
  line: 0x1f1f1f, line2: 0x2a2a2a,
  text: 0xe0e0e0, muted: 0x666666,
  white: 0xffffff,
  sky: 0x0d1117, skyHorizon: 0x121924, ground: 0x141414, groundTop: 0x22c55e
};

// ---------- 角色配置 ----------
const ENTITY_CONFIG = {
  survivor_male: {
    name: 'MALE', category: 'survivor',
    hp: 100, maxHp: 100, speed: 110, damage: 15,
    attackRange: 38, attackCooldown: 800,
    detectRange: 260, fleeRange: 100, aggression: 0.4,
    jumpPower: 320, weight: 1,
    color: PALETTE.green, accentColor: PALETTE.greenDark, skinColor: PALETTE.skin, size: 14
  },
  survivor_female: {
    name: 'FEMALE', category: 'survivor',
    hp: 85, maxHp: 85, speed: 125, damage: 11,
    attackRange: 34, attackCooldown: 700,
    detectRange: 300, fleeRange: 130, aggression: 0.25,
    jumpPower: 360, weight: 0.9,
    color: PALETTE.green, accentColor: PALETTE.greenDarker, skinColor: PALETTE.skin, size: 13
  },
  zombie_normal: {
    name: 'NORMAL', category: 'zombie',
    hp: 110, maxHp: 110, speed: 55, damage: 14,
    attackRange: 32, attackCooldown: 1000,
    detectRange: 320,
    jumpPower: 260, weight: 1.1,
    color: PALETTE.red, accentColor: PALETTE.redDark, skinColor: PALETTE.skinZ, size: 14
  },
  zombie_fast: {
    name: 'FAST', category: 'zombie',
    hp: 60, maxHp: 60, speed: 150, damage: 8,
    attackRange: 28, attackCooldown: 550,
    detectRange: 360,
    jumpPower: 380, weight: 0.8,
    color: PALETTE.red, accentColor: PALETTE.redDark, skinColor: PALETTE.skinZ, size: 12
  },
  zombie_tank: {
    name: 'TANK', category: 'zombie',
    hp: 360, maxHp: 360, speed: 35, damage: 32,
    attackRange: 40, attackCooldown: 1400,
    detectRange: 280,
    jumpPower: 180, weight: 1.8,
    color: PALETTE.red, accentColor: PALETTE.redDarker, skinColor: PALETTE.skinZ, size: 19
  }
};

// ---------- 全局状态 ----------
let gameInstance = null;
let selectedTool = null;
let gameSpeed = 1;
let paused = false;

// ============================================================
//  DOM Ready 后启动游戏 (注意: 实际调用在文件末尾, 所有类定义之后)
// ============================================================
function bootstrap() {
  function go() {
    // 隐藏 loader
    const loader = document.getElementById('loader');
    if (loader) { setTimeout(() => loader.classList.add('done'), 120); }

    // ===== 移动端触摸全局拦截: 防止双指缩放 / 长按菜单 / 双击缩放 / 页面滚动 =====
    (function lockTouch() {
      const prevent = (e) => { if (e.cancelable) e.preventDefault(); };
      document.addEventListener('touchmove', prevent, { passive: false });
      document.addEventListener('gesturestart', prevent, { passive: false });
      document.addEventListener('gesturechange', prevent, { passive: false });
      document.addEventListener('gestureend', prevent, { passive: false });
      // 阻止长按弹出菜单（iOS/Android）
      ['-webkit-touch-callout', '-webkit-user-select', 'user-select'].forEach(p => {
        document.documentElement.style[p] = 'none';
      });
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) { if (e.cancelable) e.preventDefault(); }
        lastTouchEnd = now;
      }, { passive: false });
    })();

    const container = document.getElementById('game-container');
    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: PALETTE.sky,
      scene: [BootScene, GameScene],
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 900 },
          debug: false,
          tileBias: 24
        }
      },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 3 }
    };
    gameInstance = new Phaser.Game(config);
    setupToolbar();

    window.addEventListener('resize', () => {
      // CSS强制横屏下需要重新计算container尺寸
      const html = document.documentElement;
      const rotated = html.classList.contains('force-landscape') || html.classList.contains('force-landscape-ccw');
      let cw = container.clientWidth, ch = container.clientHeight;
      if (rotated) {
        // 在旋转模式下,container的width实际是viewport height,height实际是viewport width
        cw = window.innerHeight;
        ch = window.innerWidth;
      }
      if (gameInstance) gameInstance.scale.resize(cw, ch);
    });
    // 横竖屏监听
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { checkOrientation(); triggerGameResize(); }, 250);
    }, false);
    window.addEventListener('resize', () => { setTimeout(checkOrientation, 50); }, false);
    setTimeout(checkOrientation, 200);
  }
  if (typeof Phaser !== 'undefined') go();
  else {
    // fallback: 如果 Phaser 还在加载
    let tries = 0;
    const iv = setInterval(() => {
      if (typeof Phaser !== 'undefined') { clearInterval(iv); go(); }
      else if (++tries > 80) clearInterval(iv);
    }, 50);
  }
}

function triggerGameResize() {
  if (!gameInstance) return;
  const container = document.getElementById('game-container');
  const html = document.documentElement;
  const rotated = html.classList.contains('force-landscape') || html.classList.contains('force-landscape-ccw');
  let cw = container.clientWidth, ch = container.clientHeight;
  if (rotated) {
    cw = window.innerHeight;
    ch = window.innerWidth;
  }
  gameInstance.scale.resize(cw, ch);
  const scene = gameInstance.scene.getScene('GameScene');
  if (scene && scene.onResize) scene.onResize();
}

// ---------- 横竖屏提示 ----------
function checkOrientation() {
  const mask = document.getElementById('orient-mask');
  if (!mask) return;
  const html = document.documentElement;
  // 如果已经通过CSS强制横屏，则不显示提示
  const rotated = html.classList.contains('force-landscape') || html.classList.contains('force-landscape-ccw');
  if (rotated) { mask.classList.remove('show'); return; }
  const w = window.innerWidth, h = window.innerHeight;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                   (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  // 某些iPad Safari 报告为 Macintosh,增加屏幕尺寸辅助判断
  const isSmallScreen = Math.min(w, h) < 900;
  if ((isMobile || isSmallScreen) && h > w) {
    mask.classList.add('show');
  } else {
    mask.classList.remove('show');
  }
}

// ============================================================
//  场景 1: 生成程序化纹理
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  preload() {
    try { this.load.json('assetCheck', '/api/assets'); } catch (e) {}
  }
  create() {
    Object.keys(ENTITY_CONFIG).forEach(type => {
      this.generateCharacterTexture(type, ENTITY_CONFIG[type]);
    });
    this.generateHpBarTextures();
    this.generateSkyTexture();
    this.generateGroundTexture();
    this.scene.start('GameScene');
  }

  // ---- 横版角色纹理 ----
  generateCharacterTexture(type, cfg) {
    const s = cfg.size;
    const w = s * 2, h = s * 2.8;
    const g = this.add.graphics();
    const isSurvivor = cfg.category === 'survivor';
    const prim = isSurvivor ? PALETTE.green : PALETTE.red;
    const dark = isSurvivor ? PALETTE.greenDark : PALETTE.redDark;

    // 阴影
    g.fillStyle(PALETTE.black, 0.55);
    g.fillRect(w / 2 - s * 0.8, h - 4, s * 1.6, s * 0.22);

    // 腿
    g.fillStyle(dark, 1);
    g.fillRect(w / 2 - s * 0.5, h - s * 0.85, s * 0.38, s * 0.7);
    g.fillRect(w / 2 + s * 0.12, h - s * 0.85, s * 0.38, s * 0.7);
    g.lineStyle(1.5, PALETTE.black, 1);
    g.strokeRect(w / 2 - s * 0.5, h - s * 0.85, s * 0.38, s * 0.7);
    g.strokeRect(w / 2 + s * 0.12, h - s * 0.85, s * 0.38, s * 0.7);

    // 身体 - 竖长方形
    g.fillStyle(prim, 1);
    g.fillRect(w / 2 - s * 0.6, h / 2 - s * 0.2, s * 1.2, s * 1.1);
    g.lineStyle(2, PALETTE.black, 1);
    g.strokeRect(w / 2 - s * 0.6, h / 2 - s * 0.2, s * 1.2, s * 1.1);
    // 腰带
    g.fillStyle(PALETTE.black, 1);
    g.fillRect(w / 2 - s * 0.6, h / 2 + s * 0.65, s * 1.2, s * 0.18);

    // 头
    g.fillStyle(cfg.skinColor, 1);
    g.fillRect(w / 2 - s * 0.5, h / 2 - s * 1.15, s, s * 0.95);
    g.lineStyle(2, PALETTE.black, 1);
    g.strokeRect(w / 2 - s * 0.5, h / 2 - s * 1.15, s, s * 0.95);

    // 特征区分
    if (type === 'survivor_male') {
      // 帽子
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - s * 0.5, h / 2 - s * 1.15, s, s * 0.28);
      g.fillRect(w / 2 - s * 0.65, h / 2 - s * 1.0, s * 1.3, s * 0.08);
    } else if (type === 'survivor_female') {
      // 马尾
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - s * 0.5, h / 2 - s * 1.15, s, s * 0.32);
      g.fillRect(w / 2 + s * 0.35, h / 2 - s * 0.9, s * 0.2, s * 1.1);
    } else if (type === 'zombie_fast') {
      // 斜条纹
      g.lineStyle(2, PALETTE.black, 1);
      g.beginPath();
      g.moveTo(w / 2 - s * 0.6, h / 2 + s * 0.1);
      g.lineTo(w / 2 + s * 0.1, h / 2 - s * 0.1);
      g.moveTo(w / 2 - s * 0.15, h / 2 + s * 0.7);
      g.lineTo(w / 2 + s * 0.6, h / 2 + s * 0.5);
      g.strokePath();
    } else if (type === 'zombie_tank') {
      // 铆钉 + 十字
      g.lineStyle(3, PALETTE.black, 1);
      g.beginPath();
      g.moveTo(w / 2, h / 2 - s * 0.2); g.lineTo(w / 2, h / 2 + s * 0.9);
      g.moveTo(w / 2 - s * 0.6, h / 2 + s * 0.3); g.lineTo(w / 2 + s * 0.6, h / 2 + s * 0.3);
      g.strokePath();
      g.fillStyle(PALETTE.black, 1);
      g.fillCircle(w / 2 - s * 0.5, h / 2 + s * 0.3, s * 0.08);
      g.fillCircle(w / 2 + s * 0.5, h / 2 + s * 0.3, s * 0.08);
    }

    // 面部
    if (cfg.category === 'zombie') {
      g.fillStyle(PALETTE.red, 1);
      g.fillRect(w / 2 - s * 0.35, h / 2 - s * 0.85, s * 0.2, s * 0.2);
      g.fillRect(w / 2 + s * 0.15, h / 2 - s * 0.85, s * 0.2, s * 0.2);
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - s * 0.28, h / 2 - s * 0.78, s * 0.06, s * 0.06);
      g.fillRect(w / 2 + s * 0.22, h / 2 - s * 0.78, s * 0.06, s * 0.06);
      // 嘴
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - s * 0.3, h / 2 - s * 0.5, s * 0.6, s * 0.13);
      // 獠牙
      g.fillStyle(PALETTE.white, 1);
      g.fillRect(w / 2 - s * 0.22, h / 2 - s * 0.5, s * 0.05, s * 0.1);
      g.fillRect(w / 2 + s * 0.17, h / 2 - s * 0.5, s * 0.05, s * 0.1);
    } else {
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - s * 0.32, h / 2 - s * 0.82, s * 0.14, s * 0.14);
      g.fillRect(w / 2 + s * 0.18, h / 2 - s * 0.82, s * 0.14, s * 0.14);
      g.lineStyle(1.5, PALETTE.black, 1);
      g.beginPath();
      g.moveTo(w / 2 - s * 0.2, h / 2 - s * 0.5);
      g.lineTo(w / 2 + s * 0.2, h / 2 - s * 0.5);
      g.strokePath();
    }
    g.generateTexture(type, w, h);
    g.destroy();
  }

  generateHpBarTextures() {
    const W = 44, H = 5;
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.black2, 1); bg.fillRect(0, 0, W, H);
    bg.lineStyle(1, PALETTE.line2, 1); bg.strokeRect(0, 0, W, H);
    bg.generateTexture('hpBarBg', W, H); bg.destroy();
    const mk = (c, k) => {
      const x = this.add.graphics();
      x.fillStyle(c, 1); x.fillRect(1, 1, W - 2, H - 2);
      x.generateTexture(k, W, H); x.destroy();
    };
    mk(PALETTE.green, 'hpBarGreen');
    mk(0x7a7a2a, 'hpBarYellow');
    mk(PALETTE.red, 'hpBarRed');
  }

  generateSkyTexture() {
    const w = 256, h = 256;
    const g = this.add.graphics();
    // 垂直渐变：天空 → 地平线
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(PALETTE.sky),
        Phaser.Display.Color.IntegerToColor(PALETTE.skyHorizon),
        255, Math.floor(t * 255)
      );
      g.lineStyle(1, Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.strokePath();
    }
    // 远山剪影
    g.fillStyle(PALETTE.black2, 0.9);
    g.beginPath();
    g.moveTo(0, h * 0.78);
    g.lineTo(w * 0.1, h * 0.55);
    g.lineTo(w * 0.2, h * 0.68);
    g.lineTo(w * 0.32, h * 0.48);
    g.lineTo(w * 0.45, h * 0.62);
    g.lineTo(w * 0.6, h * 0.5);
    g.lineTo(w * 0.75, h * 0.66);
    g.lineTo(w * 0.9, h * 0.52);
    g.lineTo(w, h * 0.7);
    g.lineTo(w, h); g.lineTo(0, h);
    g.closePath(); g.fillPath();
    // 星点
    for (let i = 0; i < 30; i++) {
      g.fillStyle(PALETTE.text, Math.random() * 0.6 + 0.2);
      g.fillRect(Math.random() * w, Math.random() * h * 0.5, 1, 1);
    }
    g.generateTexture('skyBg', w, h);
    g.destroy();
  }

  generateGroundTexture() {
    const w = 128, h = 48;
    const g = this.add.graphics();
    // 顶部绿色草皮条
    g.fillStyle(PALETTE.greenDark, 1);
    g.fillRect(0, 0, w, 6);
    g.fillStyle(PALETTE.green, 1);
    g.fillRect(0, 0, w, 2);
    // 地下泥土
    g.fillStyle(PALETTE.ground, 1);
    g.fillRect(0, 6, w, h - 6);
    // 泥土纹
    g.lineStyle(1, PALETTE.line, 0.9);
    for (let y = 10; y < h; y += 7) {
      g.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = y + (Math.sin(x * 0.3) * 1.2);
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.strokePath();
    }
    // 竖缝
    g.lineStyle(1, PALETTE.line, 0.5);
    for (let x = 0; x <= w; x += 32) {
      g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h); g.strokePath();
    }
    g.generateTexture('groundTile', w, h);
    g.destroy();
  }
}

// ============================================================
//  场景 2: 主游戏场景 - 2D 横版
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.entities = [];
    this.corpses = [];
    this.fightEffects = [];
    this.stats = { survivors: 0, zombies: 0, dead: 0, fights: 0 };

    this.buildMap();
    this.buildInputHandlers();

    this.time.addEvent({
      delay: 200, loop: true,
      callback: () => this.updateStatusBar()
    });

    this.scale.on('resize', this.onResize, this);
  }

  onResize() {
    if (!this.groundLayer) return;
    const { width, height } = this.scale;
    // 重建地面（贴底）
    this.rebuildGround(width, height);
    // 重建天空平铺
    if (this.skyTiles) this.skyTiles.forEach(t => t.destroy());
    this.buildSky(width, height);
  }

  buildSky(w, h) {
    this.skyTiles = [];
    const tile = this.textures.get('skyBg').getSourceImage();
    const tw = tile.width, th = tile.height;
    for (let x = 0; x < w + tw; x += tw) {
      const img = this.add.image(x, 0, 'skyBg').setOrigin(0, 0);
      const sy = h / th * 0.8;
      img.setScale(tw / tw, Math.max(1, sy));
      img.setDisplaySize(tw, Math.max(th, h * 0.8));
      img.setDepth(-5);
      this.skyTiles.push(img);
    }
  }

  buildMap() {
    const { width, height } = this.scale;

    this.buildSky(width, height);

    // 地面层（贴屏幕底部）
    this.groundHeight = Math.max(60, Math.floor(height * 0.18));
    this.groundGroup = this.physics.add.staticGroup();
    this.groundLayer = this.add.container(0, 0);
    this.groundLayer.setDepth(-2);
    this.rebuildGround(width, height);

    // 墙体（左右边界，防止走出屏幕）
    this.sideWalls = this.physics.add.staticGroup();
    const t = 30;
    const wl = this.sideWalls.create(-t / 2, height / 2, null).setSize(t, height * 2).setVisible(false).refreshBody();
    const wr = this.sideWalls.create(width + t / 2, height / 2, null).setSize(t, height * 2).setVisible(false).refreshBody();

    // 空中平台 (横向 2-3 块浮岛)
    this.platformGroup = this.physics.add.staticGroup();
    this.platformLayer = this.add.container(0, 0);
    this.platformLayer.setDepth(-1);
    this.rebuildPlatforms(width, height);
  }

  rebuildGround(w, h) {
    const gh = this.groundHeight;
    // 清理旧地面
    this.groundGroup.clear(true, true);
    this.groundLayer.removeAll(true);
    // 碰撞体
    const body = this.groundGroup.create(w / 2, h - gh / 2, null)
      .setSize(w, gh).setVisible(false).refreshBody();
    // 纹理平铺
    const tile = this.textures.get('groundTile').getSourceImage();
    const tw = tile.width, th = tile.height;
    const scale = gh / th;
    for (let x = 0; x < w + tw; x += Math.floor(tw * scale)) {
      const img = this.add.image(x, h - gh, 'groundTile').setOrigin(0, 0);
      img.setScale(scale);
      this.groundLayer.add(img);
    }
    // 地面上沿细绿线
    const top = this.add.graphics();
    top.lineStyle(1, PALETTE.green, 0.5);
    top.beginPath();
    top.moveTo(0, h - gh);
    top.lineTo(w, h - gh);
    top.strokePath();
    top.setDepth(-1);
    this.groundTopLine = top;
  }

  rebuildPlatforms(w, h) {
    this.platformGroup.clear(true, true);
    this.platformLayer.removeAll(true);
    const gh = this.groundHeight;
    // 三个平台 (左低, 中高, 右低)
    const defs = [
      { cx: w * 0.22, cy: h - gh - 110, pw: Math.min(160, w * 0.2), ph: 16 },
      { cx: w * 0.52, cy: h - gh - 180, pw: Math.min(200, w * 0.26), ph: 16 },
      { cx: w * 0.80, cy: h - gh - 120, pw: Math.min(150, w * 0.2), ph: 16 }
    ];
    const tile = this.textures.get('groundTile').getSourceImage();
    const th = tile.height;
    defs.forEach(d => {
      this.platformGroup.create(d.cx, d.cy, null)
        .setSize(d.pw, d.ph).setVisible(false).refreshBody();
      // 顶部草皮带
      const g = this.add.graphics();
      g.fillStyle(PALETTE.greenDark, 1);
      g.fillRect(d.cx - d.pw / 2, d.cy - d.ph / 2, d.pw, 4);
      g.fillStyle(PALETTE.green, 1);
      g.fillRect(d.cx - d.pw / 2, d.cy - d.ph / 2, d.pw, 1);
      g.fillStyle(PALETTE.ground, 1);
      g.fillRect(d.cx - d.pw / 2, d.cy - d.ph / 2 + 4, d.pw, d.ph - 4);
      g.lineStyle(1, PALETTE.line2, 1);
      g.strokeRect(d.cx - d.pw / 2, d.cy - d.ph / 2, d.pw, d.ph);
      this.platformLayer.add(g);
    });
  }

  // ---- 输入：点击/触摸放置（含防抖+防误触）----
  buildInputHandlers() {
    // 工具栏高度 (用于忽略点击)
    const getTopOffset = () => document.getElementById('toolbar')?.offsetHeight || 60;
    let lastPlaceTs = 0;
    let touchStartPos = null;
    const PLACE_MIN_INTERVAL = 120; // ms, 防止双触连放
    const MOVE_TOLERANCE = 12; // px, 超过这个算拖动，不放置

    const onPlace = (pointer) => {
      // 防止工具栏区域触发
      if (pointer.y <= getTopOffset()) return;
      if (!selectedTool) return;
      const now = Date.now();
      if (now - lastPlaceTs < PLACE_MIN_INTERVAL) return;
      lastPlaceTs = now;
      // 放置位置限制 (不能埋在地里)
      const { height } = this.scale;
      const gh = this.groundHeight;
      let y = Math.min(pointer.y, height - gh - 20);
      let x = Phaser.Math.Clamp(pointer.x, 30, this.scale.width - 30);
      this.spawnEntity(selectedTool, x, y);
    };

    // 区分拖动和点击
    this.input.on('pointerdown', (pointer) => {
      touchStartPos = { x: pointer.x, y: pointer.y, id: pointer.id, ts: Date.now() };
    });
    this.input.on('pointerup', (pointer) => {
      if (!touchStartPos || touchStartPos.id !== pointer.id) { touchStartPos = null; return; }
      const dx = Math.abs(pointer.x - touchStartPos.x);
      const dy = Math.abs(pointer.y - touchStartPos.y);
      touchStartPos = null;
      if (dx < MOVE_TOLERANCE && dy < MOVE_TOLERANCE) {
        onPlace(pointer);
      }
    });
    // 指针移出再回来也取消放置
    this.input.on('pointerupoutside', () => { touchStartPos = null; });

    // 预览
    this.input.on('pointermove', (pointer) => {
      if (!this.placementPreview) {
        this.placementPreview = this.add.image(pointer.x, pointer.y, selectedTool || 'survivor_male');
        this.placementPreview.setAlpha(0.5).setDepth(999);
        this.placementPreviewLine = this.add.arc(pointer.x, pointer.y, 0);
        this.placementPreviewLine.setStrokeStyle(1, PALETTE.text, 0.15);
        this.placementPreviewLine.setDepth(998);
      }
      const gh = this.groundHeight;
      const prevY = Math.min(pointer.y, this.scale.height - gh - 20);
      if (selectedTool) {
        this.placementPreview.setVisible(true);
        this.placementPreview.setPosition(pointer.x, prevY);
        this.placementPreview.setTexture(selectedTool);
        const cfg = ENTITY_CONFIG[selectedTool];
        this.placementPreviewLine.setVisible(true);
        this.placementPreviewLine.setPosition(pointer.x, prevY);
        this.placementPreviewLine.setRadius(cfg.detectRange);
        this.placementPreviewLine.setStrokeStyle(1, cfg.color, 0.5);
      } else {
        this.placementPreview.setVisible(false);
        this.placementPreviewLine.setVisible(false);
      }
    });
  }

  spawnEntity(type, x, y) {
    const cfg = ENTITY_CONFIG[type];
    const ent = {};
    ent.sprite = this.physics.add.sprite(x, y, type);
    ent.sprite.setCollideWorldBounds(true);
    ent.sprite.setBounce(0.05, 0.1);
    ent.sprite.setDepth(10);
    const r = cfg.size * 0.6;
    ent.sprite.body.setCircle(r, cfg.size * 0.2, cfg.size * 0.5);
    ent.sprite.body.setGravityY(0);
    ent.sprite.body.mass = cfg.weight;

    ent.type = type; ent.cfg = cfg;
    ent.hp = cfg.hp; ent.maxHp = cfg.maxHp;
    ent.isDead = false;
    ent.lastAttack = 0; ent.target = null; ent.aggroTimer = 0;
    ent.wanderDir = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    ent.wanderTimer = 0;
    ent.hitFlash = 0;
    ent.jumpCooldown = 0;

    // 血条
    ent.hpBarBg = this.add.image(x, y - cfg.size * 2, 'hpBarBg').setDepth(20);
    ent.hpBar = this.add.image(x, y - cfg.size * 2, 'hpBarGreen').setDepth(21);
    ent.hpBar.setOrigin(0.05, 0.5);
    ent.hpBarBg.setOrigin(0.5, 0.5);

    // 名称
    ent.nameTag = this.add.text(x, y - cfg.size * 2.8, cfg.name, {
      fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
      fontSize: '9px',
      color: cfg.category === 'survivor' ? '#22c55e' : '#ef4444',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(22).setAlpha(0.85);

    // 物理碰撞
    this.physics.add.collider(ent.sprite, this.groundGroup);
    this.physics.add.collider(ent.sprite, this.platformGroup);
    this.physics.add.collider(ent.sprite, this.sideWalls);
    this.entities.forEach(other => {
      this.physics.add.collider(ent.sprite, other.sprite, null, null, this);
    });

    this.entities.push(ent);
    this.updateStats(true);
  }

  updateStats() {
    const c = { survivor: 0, zombie: 0 };
    this.entities.forEach(e => { if (!e.isDead) c[e.cfg.category]++; });
    this.stats.survivors = c.survivor;
    this.stats.zombies = c.zombie;
    this.stats.dead = this.corpses.length;
  }

  updateStatusBar() {
    if (document.getElementById('count-survivors'))
      document.getElementById('count-survivors').textContent = this.stats.survivors;
    if (document.getElementById('count-zombies'))
      document.getElementById('count-zombies').textContent = this.stats.zombies;
    if (document.getElementById('count-dead'))
      document.getElementById('count-dead').textContent = this.stats.dead;
    if (document.getElementById('count-fights'))
      document.getElementById('count-fights').textContent = this.stats.fights;
  }

  update(time, delta) {
    if (paused) return;
    const dt = (delta / 16.666) * gameSpeed;
    const now = time * gameSpeed + (this._timeOffset || 0);
    this._timeOffset = (this._timeOffset || 0) + delta * (gameSpeed - 1);

    this.entities.forEach(ent => {
      if (ent.isDead) return;
      this.updateEntityAI(ent, now, dt, time);
      this.updateEntityVisuals(ent);
    });

    this.fightEffects = this.fightEffects.filter(fx => {
      fx.life -= delta;
      if (fx.life <= 0) { fx.sprite.destroy(); return false; }
      const a = Math.max(0, fx.life / fx.maxLife);
      fx.sprite.setAlpha(a);
      fx.sprite.y -= 0.5 * dt;
      return true;
    });

    this.updateStats();
  }

  // ---- 横版角色 AI ----
  updateEntityAI(ent, now, dt, realTime) {
    const cfg = ent.cfg;
    let nearestEnemy = null;
    let nearestDist = Infinity;
    let nearestDx = 0;

    this.entities.forEach(other => {
      if (other === ent || other.isDead) return;
      if (other.cfg.category === cfg.category) return;
      const dx = other.sprite.x - ent.sprite.x;
      const dy = other.sprite.y - ent.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = other; nearestDx = dx; }
    });

    ent.target = (nearestEnemy && nearestDist <= cfg.detectRange) ? nearestEnemy : null;
    const hasTarget = !!ent.target;

    let dirX = 0; // -1,0,1
    let tryJump = false;

    const onGround = ent.sprite.body.blocked.down || ent.sprite.body.touching.down;
    ent.jumpCooldown = Math.max(0, ent.jumpCooldown - dt);

    if (cfg.category === 'survivor') {
      if (hasTarget) {
        const d = nearestDist;
        const enemy = ent.target;
        const dxSign = Math.sign(nearestDx) || 1;

        if (d < cfg.attackRange + 6) {
          // 攻击
          this.tryAttack(ent, enemy, now, realTime);
          dirX = 0;
        } else if (d < cfg.fleeRange && Math.random() > cfg.aggression) {
          // 逃跑 (反向)
          dirX = -dxSign;
        } else if (d < cfg.detectRange && Math.random() < cfg.aggression + 0.1) {
          // 反击靠近
          dirX = dxSign;
        } else {
          // 保持距离
          const ideal = (cfg.fleeRange + cfg.detectRange) / 2;
          dirX = d < ideal ? -dxSign : dxSign;
        }
        // 被追上时跳跃逃生
        if (onGround && ent.jumpCooldown === 0 &&
            d < cfg.fleeRange * 0.7 && Math.random() < 0.025 * dt) {
          tryJump = true;
        }
      } else {
        dirX = ent.wanderDir;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          const r = Math.random();
          ent.wanderDir = r < 0.35 ? -1 : (r < 0.7 ? 1 : 0);
          ent.wanderTimer = 80 + Math.random() * 240;
        }
        // 偶尔跳
        if (onGround && ent.jumpCooldown === 0 && Math.random() < 0.006 * dt) {
          tryJump = true;
        }
      }
    } else {
      // 丧尸
      if (hasTarget) {
        const d = nearestDist;
        const dxSign = Math.sign(nearestDx) || 1;
        if (d < cfg.attackRange + 4) {
          this.tryAttack(ent, nearestEnemy, now, realTime);
          dirX = 0;
        } else {
          dirX = dxSign;
        }
        ent.aggroTimer = 3000;
        // 追击跨越: 接近敌人但有垂直落差时跳跃
        if (onGround && ent.jumpCooldown === 0) {
          const dy = nearestEnemy.sprite.y - ent.sprite.y;
          if ((dy < -30 || Math.random() < 0.008 * dt) && nearestDist < 200) tryJump = true;
        }
      } else if (ent.aggroTimer > 0) {
        dirX = ent.wanderDir;
        ent.aggroTimer -= dt * 16;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          ent.wanderDir = Math.random() < 0.5 ? -1 : 1;
          ent.wanderTimer = 30 + Math.random() * 60;
        }
      } else {
        dirX = ent.wanderDir * 0.5;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          const r = Math.random();
          ent.wanderDir = r < 0.4 ? -1 : (r < 0.8 ? 1 : 0);
          ent.wanderTimer = 140 + Math.random() * 360;
        }
      }
    }

    // 应用水平速度
    ent.sprite.setVelocityX(dirX * cfg.speed * (dt / 1));

    // 跳跃
    if (tryJump && onGround && ent.jumpCooldown === 0) {
      ent.sprite.setVelocityY(-cfg.jumpPower);
      ent.jumpCooldown = 25;
    }

    // 朝向
    if (dirX !== 0) ent.sprite.setFlipX(dirX < 0);

    // 受击闪烁
    if (ent.hitFlash > 0) {
      ent.hitFlash -= dt;
      const flashOn = Math.floor(ent.hitFlash / 3) % 2 === 0;
      ent.sprite.setTint(flashOn ? PALETTE.red : PALETTE.white);
      if (ent.hitFlash <= 0) ent.sprite.clearTint();
    }
  }

  tryAttack(attacker, defender, now, realTime) {
    if (now - attacker.lastAttack < attacker.cfg.attackCooldown) return;
    attacker.lastAttack = now;
    const variance = 0.85 + Math.random() * 0.3;
    const dmg = Math.round(attacker.cfg.damage * variance);
    this.dealDamage(defender, dmg, attacker, realTime);
    // 攻击击退
    const dir = Math.sign(defender.sprite.x - attacker.sprite.x) || 1;
    defender.sprite.setVelocityX(dir * 120);
    defender.sprite.setVelocityY(-80);
    this.showAttackEffect(attacker, defender);
    this.stats.fights++;
  }

  dealDamage(entity, dmg, attacker, realTime) {
    entity.hp -= dmg;
    entity.hitFlash = 18;
    this.showDamageNumber(entity.sprite.x, entity.sprite.y - entity.cfg.size * 2, dmg, attacker.cfg.category === 'zombie');
    if (entity.hp <= 0) this.killEntity(entity, attacker);
  }

  killEntity(entity) {
    entity.isDead = true;
    entity.sprite.setVelocityX(0);
    entity.sprite.setTint(PALETTE.muted);
    entity.sprite.setAngle(90);
    entity.sprite.setDepth(5);
    entity.sprite.body.enable = false;
    entity.hpBar.destroy();
    entity.hpBarBg.destroy();
    entity.nameTag.destroy();

    const cg = this.add.graphics();
    cg.fillStyle(PALETTE.black, 0.5);
    cg.fillRect(-entity.cfg.size, -entity.cfg.size * 0.3, entity.cfg.size * 2, entity.cfg.size * 0.6);
    cg.setPosition(entity.sprite.x, entity.sprite.y + entity.cfg.size * 0.5);
    cg.setDepth(4);
    this.corpses.push({ sprite: entity.sprite, gfx: cg });
    entity._corpseGfx = cg;

    const idx = this.entities.indexOf(entity);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  showAttackEffect(attacker, defender) {
    const fx = this.add.graphics();
    fx.lineStyle(1, attacker.cfg.color, 1);
    fx.beginPath();
    fx.moveTo(attacker.sprite.x, attacker.sprite.y - attacker.cfg.size * 0.4);
    fx.lineTo(defender.sprite.x, defender.sprite.y - defender.cfg.size * 0.6);
    fx.strokePath();
    for (let i = 0; i < 3; i++) {
      const sx = defender.sprite.x + Phaser.Math.FloatBetween(-6, 6);
      const sy = defender.sprite.y - defender.cfg.size * 0.5 + Phaser.Math.FloatBetween(-6, 6);
      fx.fillStyle(attacker.cfg.color, 1);
      fx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    this.fightEffects.push({ sprite: fx, life: 180, maxLife: 180 });
  }

  showDamageNumber(x, y, dmg, isZombieAttack) {
    const color = isZombieAttack ? '#ef4444' : '#22c55e';
    const txt = this.add.text(x + Phaser.Math.FloatBetween(-6, 6), y, '-' + dmg, {
      fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
      fontSize: 'bold 12px', color: color
    }).setOrigin(0.5).setDepth(30);
    this.fightEffects.push({ sprite: txt, life: 650, maxLife: 650 });
  }

  updateEntityVisuals(ent) {
    if (ent.isDead) return;
    const size = ent.cfg.size;
    const bx = ent.sprite.x;
    const by = ent.sprite.y - size * 1.9;
    ent.hpBarBg.setPosition(bx, by);
    ent.hpBar.setPosition(bx - 21, by);
    const pct = Math.max(0, ent.hp / ent.maxHp);
    ent.hpBar.setScale(pct, 1);
    if (pct > 0.6) ent.hpBar.setTexture('hpBarGreen');
    else if (pct > 0.3) ent.hpBar.setTexture('hpBarYellow');
    else ent.hpBar.setTexture('hpBarRed');
    ent.nameTag.setPosition(ent.sprite.x, ent.sprite.y - size * 2.8);
  }

  clearAll() {
    this.entities.forEach(e => {
      e.sprite.destroy();
      e.hpBar?.destroy(); e.hpBarBg?.destroy(); e.nameTag?.destroy();
    });
    this.entities = [];
    this.corpses.forEach(c => { c.sprite.destroy(); c.gfx?.destroy(); });
    this.corpses = [];
    this.fightEffects.forEach(fx => fx.sprite.destroy());
    this.fightEffects = [];
    this.stats = { survivors: 0, zombies: 0, dead: 0, fights: 0 };
  }

  clearZombies() {
    const toRemove = this.entities.filter(e => e.cfg.category === 'zombie');
    toRemove.forEach(e => {
      e.sprite.destroy();
      e.hpBar?.destroy(); e.hpBarBg?.destroy(); e.nameTag?.destroy();
      const idx = this.entities.indexOf(e);
      if (idx >= 0) this.entities.splice(idx, 1);
    });
  }
}

// ============================================================
//  工具栏 + 横屏全屏
// ============================================================
function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (selectedTool === type) {
        selectedTool = null;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      } else {
        selectedTool = type;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn?.addEventListener('click', () => {
    paused = !paused;
    const span = pauseBtn.querySelector('span');
    if (span) span.textContent = paused ? 'PLAY' : 'PAUSE';
  });

  const speedBtn = document.getElementById('btn-speed');
  const speeds = [1, 2, 3, 0.5];
  let speedIdx = 0;
  speedBtn?.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % speeds.length;
    gameSpeed = speeds[speedIdx];
    const span = speedBtn.querySelector('span');
    if (span) span.textContent = gameSpeed + 'X';
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene) scene.clearAll();
  });
  document.getElementById('btn-clear-zombies')?.addEventListener('click', () => {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene) scene.clearZombies();
  });

  // ======== 一键横屏全屏按钮 (增强版: Fullscreen -> Orientation Lock -> CSS Rotate) ========
  let cssRotated = false;
  function clearCssRotate() {
    const html = document.documentElement;
    html.classList.remove('force-landscape');
    html.classList.remove('force-landscape-ccw');
    cssRotated = false;
  }
  function applyCssRotate(ccw) {
    const html = document.documentElement;
    clearCssRotate();
    html.classList.add(ccw ? 'force-landscape-ccw' : 'force-landscape');
    cssRotated = true;
    setTimeout(() => {
      checkOrientation();
      triggerGameResize();
    }, 60);
  }
  function exitFullscreenSafe() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen ||
                 document.mozCancelFullScreen || document.msExitFullscreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement ||
                 document.mozFullScreenElement || document.msFullscreenElement)) {
      return exit.call(document).catch(() => {});
    }
    return Promise.resolve();
  }

  document.getElementById('btn-landscape')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const span = btn.querySelector('span');
    if (btn.classList.contains('landscape-loading')) return; // 防止重复点击
    btn.classList.add('landscape-loading');
    const origText = span ? span.textContent : 'LANDSCAPE';
    if (span) span.textContent = 'LOADING';

    try {
      // ====== 第一步: 如果已经在横屏了，退出所有模式 ======
      const w = window.innerWidth, h = window.innerHeight;
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                       (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const currentlyLandscape = w > h || cssRotated;
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement ||
                      document.mozFullScreenElement || document.msFullscreenElement);
      const sO = screen?.orientation || screen?.mozOrientation || screen?.msOrientation;
      let orLockOk = false;
      try { orLockOk = !!(sO && (sO.type || '').startsWith('landscape')); } catch (e) {}

      if (currentlyLandscape && (inFs || cssRotated || orLockOk)) {
        // 退出模式: 依次尝试解除
        try { if (sO?.unlock) await sO.unlock(); } catch (e) {}
        await exitFullscreenSafe();
        clearCssRotate();
        setTimeout(() => { checkOrientation(); triggerGameResize(); }, 50);
        btn.classList.remove('landscape-loading');
        if (span) span.textContent = origText;
        return;
      }

      // ====== 第二步: 请求全屏 (必须在用户手势内调用) ======
      const el = document.documentElement;
      const reqFs = el.requestFullscreen || el.webkitRequestFullscreen ||
                    el.mozRequestFullScreen || el.msRequestFullscreen;
      let wentFs = false;
      if (reqFs && !inFs) {
        try { await reqFs.call(el); wentFs = true; }
        catch (e) { /* 某些浏览器需要用户手势更严格,忽略继续 */ }
      }
      // 部分浏览器 requestFullscreen 是异步但需要等待下一帧才真正生效
      await new Promise(r => setTimeout(r, 80));

      // ====== 第三步: 尝试锁定横屏方向 ======
      let locked = false;
      if (sO) {
        const lock = sO.lock || sO.lockOrientation;
        if (lock) {
          const candidates = ['landscape-primary', 'landscape-secondary', 'landscape'];
          for (let i = 0; i < candidates.length && !locked; i++) {
            try {
              const res = await lock.call(sO, candidates[i]);
              if (res !== false) locked = true;
            } catch (e) { /* 继续尝试下一个 */ }
          }
          // 部分老浏览器是同步返回 boolean
          if (!locked && sO.lockOrientation) {
            try { locked = !!sO.lockOrientation('landscape'); } catch (e) {}
          }
        }
      }
      await new Promise(r => setTimeout(r, 50));

      // ====== 第四步: 如果方向锁失败,尝试重试全屏(某些浏览器先全屏再锁才有效) ======
      if (!locked && !wentFs && reqFs) {
        try { await reqFs.call(el); wentFs = true; } catch (e) {}
        await new Promise(r => setTimeout(r, 120));
        if (sO) {
          const lock = sO.lock || sO.lockOrientation;
          if (lock) {
            try {
              const res = await lock.call(sO, 'landscape');
              if (res !== false) locked = true;
            } catch (e) {}
          }
        }
      }

      // ====== 第五步: 终极 fallback - CSS 强制旋转 (iOS Safari / 老浏览器) ======
      if (!locked) {
        const w2 = window.innerWidth, h2 = window.innerHeight;
        if (h2 > w2) {
          // 判断优先方向: 默认顺时针旋转90°
          // 某些设备/场景逆时针更优（如iOS Safari带地址栏）
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          applyCssRotate(false /* 顺时针默认 */);
          // 150ms后检查旋转结果，如果尺寸还是不对尝试反向
          setTimeout(() => {
            const body = document.body;
            if (!body) return;
            const rect = body.getBoundingClientRect();
            // 如果旋转后 body 的可视区域宽高比异常，尝试反向
            if (rect.width < 0 || isIOS) {
              // 某些iOS Safari需要反向
            }
            triggerGameResize();
          }, 200);
        }
      }

      // ====== 提示反馈 ======
      let mode = '';
      if (locked && wentFs) mode = 'FULL+ORIENT';
      else if (locked) mode = 'ORIENT LOCK';
      else if (wentFs) mode = 'FULLSCREEN';
      else if (cssRotated) mode = 'ROTATE';

      if (!mode) {
        const tip = document.getElementById('asset-hint');
        if (tip) {
          const orig = tip.innerHTML;
          tip.innerHTML = '<strong style="color:#ef4444">TIP</strong> &mdash; 请手动旋转手机横屏；iOS用户请「添加到主屏幕」后以PWA方式打开，支持全屏横屏。';
          setTimeout(() => { tip.innerHTML = orig; }, 5000);
        }
      }
      if (span) span.textContent = mode || origText;
      setTimeout(() => {
        btn.classList.remove('landscape-loading');
        if (span && !mode) span.textContent = origText;
        else if (span && mode) span.textContent = mode;
      }, 900);
      setTimeout(() => {
        if (span) span.textContent = origText;
      }, 3000);

    } catch (err) {
      console.warn('Landscape error:', err);
      btn.classList.remove('landscape-loading');
      if (span) span.textContent = origText;
    }
  });

  // 监听全屏退出，同步清理CSS旋转
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evName => {
    document.addEventListener(evName, () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement ||
                      document.mozFullScreenElement || document.msFullscreenElement);
      if (!inFs && cssRotated) {
        // 用户手动退出全屏，也保留CSS旋转（因为用户需要横屏）
      }
      setTimeout(() => { checkOrientation(); triggerGameResize(); }, 100);
    });
  });

  // 键盘快捷键
  window.addEventListener('keydown', (e) => {
    const keyMap = { '1': 'survivor_male', '2': 'survivor_female', '3': 'zombie_normal', '4': 'zombie_fast', '5': 'zombie_tank' };
    if (keyMap[e.key]) {
      const btn = document.querySelector(`.tool-btn[data-type="${keyMap[e.key]}"]`);
      if (btn) btn.click();
    } else if (e.code === 'Space') {
      e.preventDefault();
      pauseBtn?.click();
    } else if (e.key === 'Escape') {
      selectedTool = null;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    }
  });
}

// ============================================================
//  启动：所有类/函数定义完毕后, 执行 bootstrap
// ============================================================
bootstrap();
