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

  // ===== 世界尺寸常量 (和 viewport 无关, 固定宽幅横版 5:2) =====
  static get WORLD_W() { return 3200; }
  static get WORLD_H() { return 1280; }
  static get GROUND_H() { return 240; } // 世界底部地面高度（视觉更厚,不再贴地）
  static get MIN_ZOOM() { return 0.35; }
  static get MAX_ZOOM() { return 2.0; }

  create() {
    this.entities = [];
    this.corpses = [];
    this.fightEffects = [];
    this.stats = { survivors: 0, zombies: 0, dead: 0, fights: 0 };

    const WORLD_W = GameScene.WORLD_W;
    const WORLD_H = GameScene.WORLD_H;

    // 物理世界边界 (侧墙/地面/顶部基于这个)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H, true, true, true, true);

    // 摄像机边界
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor(PALETTE.sky);

    // 摄像机初始缩放: 把世界宽度装进 viewport, 至少看到 1/3 世界高度
    const vw = this.scale.width, vh = this.scale.height;
    const baseZoom = Math.min(vw / WORLD_W, vh / (WORLD_H * 0.68));
    this.cameras.main.setZoom(baseZoom);
    this.cameras.main.centerOn(WORLD_W * 0.5, WORLD_H * 0.56); // 初始稍微朝下看(地面在下方 40%)
    this._baseZoom = baseZoom;

    this.buildMap();
    this.setupCameraControls();
    this.buildInputHandlers();

    this.time.addEvent({
      delay: 200, loop: true,
      callback: () => this.updateStatusBar()
    });

    this.scale.on('resize', this.onResize, this);

    // 暴露方法给外部 (比如 toolbar 重置视角按钮)
    this._resetCameraView = () => {
      const w = this.scale.width, h = this.scale.height;
      const z = Math.min(w / WORLD_W, h / (WORLD_H * 0.68));
      this.cameras.main.setZoom(z);
      this.cameras.main.centerOn(WORLD_W * 0.5, WORLD_H * 0.56);
    };
    this._focusOn = (x, y) => {
      const cam = this.cameras.main;
      const targetX = Phaser.Math.Clamp(x, 0, WORLD_W);
      const targetY = Phaser.Math.Clamp(y, 0, WORLD_H);
      this.tweens.add({
        targets: cam,
        scrollX: targetX - (this.scale.width / 2) / cam.zoom,
        scrollY: targetY - (this.scale.height / 2) / cam.zoom,
        duration: 360, ease: 'Cubic.Out'
      });
    };
  }

  onResize() {
    if (!this.groundLayer) return;
    const WORLD_W = GameScene.WORLD_W, WORLD_H = GameScene.WORLD_H;
    // 重建天空平铺（按世界大小）
    if (this.skyTiles) this.skyTiles.forEach(t => t.destroy());
    this.buildSky(WORLD_W, WORLD_H);
    // 让相机始终在世界边界内
    const cam = this.cameras.main;
    if (cam) {
      cam.setBounds(0, 0, WORLD_W, WORLD_H);
    }
  }

  buildSky(w, h) {
    this.skyTiles = [];
    const tile = this.textures.get('skyBg').getSourceImage();
    const tw = tile.width, th = tile.height;
    // 横向平铺 2 层: 天空 80% + 地平线远山 20%
    const skyH = h * 0.78;
    for (let x = 0; x < w + tw; x += tw) {
      const img = this.add.image(x, 0, 'skyBg').setOrigin(0, 0);
      img.setDisplaySize(tw, skyH);
      img.setDepth(-5);
      this.skyTiles.push(img);
    }
    // 远山层 - 程序化画一条绿色山脉剪影
    if (this.mountainLayer) this.mountainLayer.destroy();
    const mtn = this.add.graphics();
    mtn.setDepth(-4);
    mtn.fillStyle(0x12221a, 0.85);
    mtn.beginPath();
    mtn.moveTo(0, skyH);
    let lastY = skyH - h * 0.03;
    mtn.lineTo(0, lastY);
    for (let x = 0; x <= w; x += 60) {
      const peakH = 0.04 + 0.06 * Math.abs(Math.sin(x * 0.0018 + 1.2));
      lastY = skyH - h * peakH - 18 * Math.sin(x * 0.02);
      mtn.lineTo(x, lastY);
    }
    mtn.lineTo(w, skyH);
    mtn.closePath();
    mtn.fillPath();
    // 第二层近山
    mtn.fillStyle(0x0a1a12, 0.9);
    mtn.beginPath();
    mtn.moveTo(0, skyH + 16);
    for (let x = 0; x <= w; x += 40) {
      const peakH = 0.02 + 0.045 * Math.abs(Math.sin(x * 0.004 + 3.1));
      const y = skyH + 16 - h * peakH - 12 * Math.cos(x * 0.03);
      mtn.lineTo(x, y);
    }
    mtn.lineTo(w, skyH + 16);
    mtn.closePath();
    mtn.fillPath();
    this.mountainLayer = mtn;
    this._skyH = skyH;
  }

  buildMap() {
    const WORLD_W = GameScene.WORLD_W;
    const WORLD_H = GameScene.WORLD_H;
    const GROUND_H = GameScene.GROUND_H;

    this.buildSky(WORLD_W, WORLD_H);

    this.groundHeight = GROUND_H;
    this.groundGroup = this.physics.add.staticGroup();
    this.groundLayer = this.add.container(0, 0);
    this.groundLayer.setDepth(-2);
    this.rebuildGround(WORLD_W, WORLD_H);

    // 侧墙（世界边界两侧,比世界略高,防止跳出）
    this.sideWalls = this.physics.add.staticGroup();
    const t = 40;
    this.sideWalls.create(-t / 2, WORLD_H / 2, null).setSize(t, WORLD_H * 1.4).setVisible(false).refreshBody();
    this.sideWalls.create(WORLD_W + t / 2, WORLD_H / 2, null).setSize(t, WORLD_H * 1.4).setVisible(false).refreshBody();

    this.platformGroup = this.physics.add.staticGroup();
    this.platformLayer = this.add.container(0, 0);
    this.platformLayer.setDepth(-1);
    this.rebuildPlatforms(WORLD_W, WORLD_H);
  }

  rebuildGround(w, h) {
    const gh = this.groundHeight;
    this.groundGroup.clear(true, true);
    this.groundLayer.removeAll(true);
    // 地面碰撞体（贴世界底部）
    this.groundGroup.create(w / 2, h - gh / 2, null)
      .setSize(w, gh).setVisible(false).refreshBody();
    // 纹理平铺
    const tile = this.textures.get('groundTile').getSourceImage();
    const tw = tile.width, th = tile.height;
    const scale = gh / th;
    const step = Math.floor(tw * scale);
    for (let x = 0; x < w + tw; x += step) {
      const img = this.add.image(x, h - gh, 'groundTile').setOrigin(0, 0);
      img.setScale(scale);
      this.groundLayer.add(img);
    }
    // 地面上沿粗绿线（草皮）
    if (this.groundTopLine) this.groundTopLine.destroy();
    const top = this.add.graphics();
    top.setDepth(-1);
    // 草皮上层
    top.fillStyle(0x14532d, 1);
    top.fillRect(0, h - gh, w, 8);
    top.fillStyle(PALETTE.green, 0.85);
    top.fillRect(0, h - gh, w, 2);
    // 点缀小草
    top.fillStyle(PALETTE.green, 0.45);
    for (let x = 0; x < w; x += 18) {
      const gx = x + ((x / 18) % 3) * 3;
      top.fillRect(gx, h - gh - 4, 1, 4);
      top.fillRect(gx + 2, h - gh - 3, 1, 3);
    }
    this.groundTopLine = top;
  }

  rebuildPlatforms(w, h) {
    this.platformGroup.clear(true, true);
    this.platformLayer.removeAll(true);
    const gh = this.groundHeight;
    const groundTopY = h - gh; // 地面顶部的世界坐标Y
    // 8 个平台: 5 层高度, 左右错落分布
    // 高度层: groundTopY - 90, -180, -280, -400, -540
    const LAYERS = [90, 180, 280, 400, 540].map(d => groundTopY - d);
    // 每个平台: cx(比例), cy层, 宽, 厚
    const defs = [
      { cxPct: 0.09,  layer: 0, pw: 260, ph: 22 }, // 地面+90 最左
      { cxPct: 0.26,  layer: 1, pw: 300, ph: 22 }, // 地面+180 左上
      { cxPct: 0.42,  layer: 3, pw: 220, ph: 22 }, // 地面+400 中高
      { cxPct: 0.50,  layer: 2, pw: 380, ph: 22 }, // 地面+280 中间长桥
      { cxPct: 0.58,  layer: 4, pw: 180, ph: 22 }, // 地面+540 最高
      { cxPct: 0.74,  layer: 1, pw: 300, ph: 22 }, // 地面+180 右上
      { cxPct: 0.88,  layer: 2, pw: 260, ph: 22 }, // 地面+280 右中
      { cxPct: 0.95,  layer: 0, pw: 220, ph: 22 }, // 地面+90 最右
    ];
    const tile = this.textures.get('groundTile').getSourceImage();
    const th = tile.height;
    defs.forEach((d, idx) => {
      const cx = w * d.cxPct;
      const cy = LAYERS[d.layer] - d.ph / 2; // 平台中心
      this.platformGroup.create(cx, cy, null)
        .setSize(d.pw, d.ph).setVisible(false).refreshBody();
      // 绘制平台外观: 草皮顶 + 泥土底 + 深色边缘
      const g = this.add.graphics();
      // 阴影
      g.fillStyle(0x000000, 0.35);
      g.fillRect(cx - d.pw / 2 + 4, cy - d.ph / 2 + 6, d.pw, d.ph);
      // 泥土
      g.fillStyle(PALETTE.ground, 1);
      g.fillRect(cx - d.pw / 2, cy - d.ph / 2, d.pw, d.ph);
      // 草皮带
      g.fillStyle(0x14532d, 1);
      g.fillRect(cx - d.pw / 2, cy - d.ph / 2, d.pw, 6);
      g.fillStyle(PALETTE.green, 1);
      g.fillRect(cx - d.pw / 2, cy - d.ph / 2, d.pw, 2);
      // 边缘轮廓
      g.lineStyle(1.2, PALETTE.line2, 0.9);
      g.strokeRect(cx - d.pw / 2, cy - d.ph / 2, d.pw, d.ph);
      // 支柱 (左右两个小木柱向下)
      const pillarH = Math.min(40 + (LAYERS[d.layer] - groundTopY + d.layer * 16), 90);
      if (pillarH > 20) {
        g.fillStyle(0x0f0f0f, 1);
        g.fillRect(cx - d.pw / 2 + 10, cy + d.ph / 2, 6, pillarH);
        g.fillRect(cx + d.pw / 2 - 16, cy + d.ph / 2, 6, pillarH);
        g.lineStyle(1, PALETTE.line2, 0.6);
        g.strokeRect(cx - d.pw / 2 + 10, cy + d.ph / 2, 6, pillarH);
        g.strokeRect(cx + d.pw / 2 - 16, cy + d.ph / 2, 6, pillarH);
      }
      this.platformLayer.add(g);
    });
    // 装饰: 天空中几朵云 (不参与物理)
    if (this.cloudLayer) this.cloudLayer.destroy();
    const clouds = this.add.graphics();
    clouds.setDepth(-3);
    clouds.fillStyle(0x1f3a2d, 0.45);
    const cloudsDefs = [
      { x: w * 0.10, y: h * 0.14, w: 170, h: 48 },
      { x: w * 0.32, y: h * 0.08, w: 210, h: 60 },
      { x: w * 0.58, y: h * 0.20, w: 140, h: 42 },
      { x: w * 0.78, y: h * 0.11, w: 250, h: 70 },
      { x: w * 0.92, y: h * 0.24, w: 160, h: 46 },
    ];
    cloudsDefs.forEach(c => {
      // 3 段椭圆拼成云
      clouds.fillCircle(c.x,           c.y + c.h * 0.5, c.h * 0.6);
      clouds.fillCircle(c.x + c.w*0.30, c.y,             c.h * 0.85);
      clouds.fillCircle(c.x + c.w*0.55, c.y + c.h * 0.25,c.h * 0.9);
      clouds.fillCircle(c.x + c.w*0.80, c.y + c.h * 0.55,c.h * 0.65);
      clouds.fillCircle(c.x + c.w,      c.y + c.h * 0.4, c.h * 0.55);
    });
    this.cloudLayer = clouds;
  }

  // ---------- 摄像机控制: 拖动平移 / 滚轮缩放 / 双指捏合 / WASD 平移 ----------
  setupCameraControls() {
    const cam = this.cameras.main;
    const WORLD_W = GameScene.WORLD_W, WORLD_H = GameScene.WORLD_H;
    const MIN_Z = GameScene.MIN_ZOOM, MAX_Z = GameScene.MAX_ZOOM;

    // --- 桌面: 按住右键拖动 或 按住左键(未选中工具时) 拖动 ---
    let isDragging = false;
    let dragStartCam = null;
    let dragStartPointer = null;
    const isPointerInUI = (p) => {
      // 点击坐标是世界坐标还是屏幕坐标? Phaser pointer.y 是DOM屏幕坐标
      // 用浏览器原生 elementFromPoint 判断是否落在 html UI 上 (toolbar/fab/status-bar)
      if (typeof document === 'undefined') return false;
      const el = document.elementFromPoint(p.x + document.getElementById('game-container').getBoundingClientRect().left,
                                           p.y + document.getElementById('game-container').getBoundingClientRect().top);
      if (!el) return false;
      let cur = el;
      while (cur) {
        if (cur.id === 'toolbar' || cur.id === 'fab' || cur.id === 'fab-panel' || cur.id === 'status-bar' || cur.id === 'orient-mask') return true;
        cur = cur.parentElement;
      }
      return false;
    };

    this.input.on('pointerdown', (pointer) => {
      const canDrag =
        pointer.rightButtonDown() ||
        pointer.middleButtonDown() ||
        (!selectedTool && pointer.leftButtonDown());
      if (!canDrag) { isDragging = false; return; }
      if (isPointerInUI(pointer)) { isDragging = false; return; }
      isDragging = true;
      dragStartCam = { x: cam.scrollX, y: cam.scrollY };
      dragStartPointer = { x: pointer.x, y: pointer.y, id: pointer.id };
    });

    this.input.on('pointermove', (pointer) => {
      if (!isDragging || !dragStartCam || !dragStartPointer) return;
      if (dragStartPointer.id !== pointer.id) return;
      const z = cam.zoom;
      cam.scrollX = dragStartCam.x - (pointer.x - dragStartPointer.x) / z;
      cam.scrollY = dragStartCam.y - (pointer.y - dragStartPointer.y) / z;
    });

    this.input.on('pointerup', (pointer) => {
      if (dragStartPointer && dragStartPointer.id === pointer.id) {
        isDragging = false;
        dragStartCam = null;
        dragStartPointer = null;
      }
    });
    this.input.on('pointerupoutside', () => { isDragging = false; dragStartCam=null; dragStartPointer=null; });

    // --- 桌面: 鼠标滚轮缩放(以鼠标指针下为中心) ---
    const gameCanvas = this.game.canvas;
    this._wheelHandler = (e) => {
      e.preventDefault();
      const rect = gameCanvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const delta = e.deltaY;
      const factor = delta < 0 ? 1.12 : 0.9;
      this.zoomAtScreenPoint(px, py, factor, MIN_Z, MAX_Z);
    };
    if (gameCanvas) gameCanvas.addEventListener('wheel', this._wheelHandler, { passive: false });

    // --- 移动端: 双指捏合缩放 ---
    this.input.addPointer(2); // 保证 activePointers=3 足够
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchStartCX = 0, pinchStartCY = 0;
    this.input.on('pointerdown', () => {
      const p0 = this.input.pointers[0];
      const p1 = this.input.pointers[1];
      if (p0 && p1 && p0.active && p1.active) {
        pinchStartDist = Phaser.Math.Distance.Between(p0.x, p0.y, p1.x, p1.y);
        pinchStartZoom = cam.zoom;
        pinchStartCX = (p0.x + p1.x) / 2;
        pinchStartCY = (p0.y + p1.y) / 2;
      }
    });
    this.input.on('pointermove', () => {
      const p0 = this.input.pointers[0];
      const p1 = this.input.pointers[1];
      if (!pinchStartDist || !p0 || !p1 || !p0.active || !p1.active) return;
      const d = Phaser.Math.Distance.Between(p0.x, p0.y, p1.x, p1.y);
      if (d < 5) return;
      const ratio = d / pinchStartDist;
      let newZoom = Phaser.Math.Clamp(pinchStartZoom * ratio, MIN_Z, MAX_Z);
      const factor = newZoom / cam.zoom;
      if (Math.abs(factor - 1) < 0.005) return;
      this.zoomAtScreenPoint(pinchStartCX, pinchStartCY, factor, MIN_Z, MAX_Z);
    });
    const endPinch = () => { pinchStartDist = 0; };
    this.input.on('pointerup', endPinch);
    this.input.on('pointerupoutside', endPinch);

    // --- WASD 键盘平移 ---
    this._wasdKeys = this.input.keyboard?.addKeys({
      up: 'W,up', left: 'A,left', down: 'S,down', right: 'D,right',
      resetView: 'Home,R'
    }) || null;
    this._camPanSpeed = 24; // px per frame (in screen pixels at zoom=1)
  }

  // 以屏幕 (px,py) 为锚点缩放
  zoomAtScreenPoint(px, py, factor, minZ, maxZ) {
    const cam = this.cameras.main;
    const beforeZoom = cam.zoom;
    const newZoom = Phaser.Math.Clamp(beforeZoom * factor, minZ, maxZ);
    if (Math.abs(newZoom - beforeZoom) < 0.001) return;
    // 把屏幕点转成世界点
    const wx = cam.scrollX + px / beforeZoom;
    const wy = cam.scrollY + py / beforeZoom;
    cam.setZoom(newZoom);
    // 保持屏幕点下的世界点不变
    cam.scrollX = wx - px / newZoom;
    cam.scrollY = wy - py / newZoom;
  }

  update(_, deltaMs) {
    // WASD 平移
    if (this._wasdKeys) {
      const cam = this.cameras.main;
      const z = cam.zoom;
      const pxPerFrame = this._camPanSpeed * (deltaMs / 16.67);
      // 按屏幕像素平移 → 转成世界像素
      const worldStep = pxPerFrame / z;
      let dx = 0, dy = 0;
      if (this._wasdKeys.left.isDown) dx -= worldStep;
      if (this._wasdKeys.right.isDown) dx += worldStep;
      if (this._wasdKeys.up.isDown) dy -= worldStep;
      if (this._wasdKeys.down.isDown) dy += worldStep;
      if (dx || dy) {
        cam.scrollX = Phaser.Math.Clamp(cam.scrollX + dx, 0, GameScene.WORLD_W - this.scale.width / z);
        cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, GameScene.WORLD_H - this.scale.height / z);
      }
      if (this._wasdKeys.resetView.isDown && this._resetCameraView) {
        this._resetCameraView();
      }
    }
  }

  // ---- 输入：点击/触摸放置（屏幕坐标→世界坐标,含防抖+防误触）----
  buildInputHandlers() {
    const WORLD_W = GameScene.WORLD_W, WORLD_H = GameScene.WORLD_H;
    const getTopOffset = () => document.getElementById('toolbar')?.offsetHeight || 60;
    const isFabPanelOpen = () => document.getElementById('fab-panel')?.classList.contains('open');
    const isPointerInHtmlUI = (p) => {
      if (typeof document === 'undefined') return false;
      const container = document.getElementById('game-container');
      if (!container) return false;
      const rect = container.getBoundingClientRect();
      const el = document.elementFromPoint(p.x + rect.left, p.y + rect.top);
      if (!el) return false;
      let cur = el;
      while (cur) {
        if (cur.id === 'toolbar' || cur.id === 'fab' || cur.id === 'fab-panel' ||
            cur.id === 'status-bar' || cur.id === 'orient-mask' ||
            cur.id === 'asset-hint' || cur.id === 'loader' || cur.id === 'tooltip') return true;
        cur = cur.parentElement;
      }
      return false;
    };
    let lastPlaceTs = 0;
    let touchStartPos = null;
    let startedDragCam = false; // 此次 pointerdown 是否触发了摄像机拖拽
    const PLACE_MIN_INTERVAL = 120;
    const MOVE_TOLERANCE = 12;

    const onPlace = (pointer) => {
      if (!selectedTool) return;
      if (isPointerInHtmlUI(pointer)) return;
      // 横屏顶栏隐藏后, 顶部没有 toolbar; 非隐藏模式下过滤 toolbar 点击
      const topBarHidden = document.body.classList.contains('hide-toolbar');
      if (!topBarHidden && pointer.y <= getTopOffset()) return;
      const now = Date.now();
      if (now - lastPlaceTs < PLACE_MIN_INTERVAL) return;
      lastPlaceTs = now;
      // 屏幕坐标 -> 世界坐标
      const cam = this.cameras.main;
      const worldPt = cam.getWorldPoint(pointer.x, pointer.y);
      const groundTopY = WORLD_H - this.groundHeight;
      // 限制: 不能埋在地里, 不能出世界边界
      const cfg = ENTITY_CONFIG[selectedTool];
      const marginX = cfg.size * 1.2;
      const placeMinY = cfg.size * 2;
      const placeMaxY = groundTopY - cfg.size * 0.6;
      let x = Phaser.Math.Clamp(worldPt.x, marginX, WORLD_W - marginX);
      let y = Phaser.Math.Clamp(worldPt.y, placeMinY, placeMaxY);
      this.spawnEntity(selectedTool, x, y);
      // 摄像机聚焦到放置位置（tween动画）
      if (this._focusOn) this._focusOn(x, y - 40);
    };

    // 区分：摄像机拖动（右键 / 中键 / 无工具左键）和放置点击
    this.input.on('pointerdown', (pointer) => {
      startedDragCam = false;
      touchStartPos = null;
      if (isPointerInHtmlUI(pointer)) return;
      const leftNoTool = !selectedTool && pointer.leftButtonDown();
      const wantDrag = pointer.rightButtonDown() || pointer.middleButtonDown() || leftNoTool;
      if (wantDrag) {
        startedDragCam = true; // 摄像机 setupCameraControls 会处理
        return;
      }
      // 只有"选中工具+左键点击"才认为是放置尝试
      if (selectedTool && pointer.leftButtonDown()) {
        touchStartPos = { x: pointer.x, y: pointer.y, id: pointer.id, ts: Date.now() };
      }
    });
    this.input.on('pointerup', (pointer) => {
      if (startedDragCam) { startedDragCam = false; return; }
      if (!touchStartPos || touchStartPos.id !== pointer.id) { touchStartPos = null; return; }
      const dx = Math.abs(pointer.x - touchStartPos.x);
      const dy = Math.abs(pointer.y - touchStartPos.y);
      touchStartPos = null;
      if (dx < MOVE_TOLERANCE && dy < MOVE_TOLERANCE) {
        onPlace(pointer);
      }
    });
    this.input.on('pointerupoutside', () => { touchStartPos = null; startedDragCam = false; });

    // 预览: 把屏幕坐标->世界坐标,跟随鼠标/手指
    this.input.on('pointermove', (pointer) => {
      const cam = this.cameras.main;
      if (!this.placementPreview) {
        this.placementPreview = this.add.image(0, 0, 'survivor_male').setAlpha(0.5).setDepth(999);
        this.placementPreviewLine = this.add.arc(0, 0, 0).setStrokeStyle(1, PALETTE.text, 0.15).setDepth(998);
      }
      if (selectedTool && !isPointerInHtmlUI(pointer)) {
        const worldPt = cam.getWorldPoint(pointer.x, pointer.y);
        const groundTopY = WORLD_H - this.groundHeight;
        const cfg = ENTITY_CONFIG[selectedTool];
        const prevY = Phaser.Math.Clamp(worldPt.y, cfg.size * 2, groundTopY - cfg.size * 0.6);
        const prevX = Phaser.Math.Clamp(worldPt.x, cfg.size, WORLD_W - cfg.size);
        this.placementPreview.setVisible(true);
        this.placementPreview.setPosition(prevX, prevY);
        this.placementPreview.setTexture(selectedTool);
        this.placementPreviewLine.setVisible(true);
        this.placementPreviewLine.setPosition(prevX, prevY);
        this.placementPreviewLine.setRadius(cfg.detectRange);
        this.placementPreviewLine.setStrokeStyle(1, cfg.color, 0.55);
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
    // ========== 摄像机: WASD / 方向键 / Home,R 重置视角 ==========
    if (this._wasdKeys) {
      const cam = this.cameras.main;
      const z = cam.zoom;
      const pxPerFrame = this._camPanSpeed * (delta / 16.67);
      const worldStep = pxPerFrame / z;
      let dx = 0, dy = 0;
      if (this._wasdKeys.left.isDown) dx -= worldStep;
      if (this._wasdKeys.right.isDown) dx += worldStep;
      if (this._wasdKeys.up.isDown) dy -= worldStep;
      if (this._wasdKeys.down.isDown) dy += worldStep;
      if (dx || dy) {
        const WORLD_W = GameScene.WORLD_W, WORLD_H = GameScene.WORLD_H;
        cam.scrollX = Phaser.Math.Clamp(cam.scrollX + dx, 0, Math.max(0, WORLD_W - this.scale.width / z));
        cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, Math.max(0, WORLD_H - this.scale.height / z));
      }
      if (this._wasdKeys.resetView.isDown && this._resetCameraView) {
        this._resetCameraView();
      }
    }

    if (paused) return;

    // ========== 战斗/AI / 特效 ==========
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
//  工具栏 + 横屏全屏 + 悬浮球面板
// ============================================================

// --------- 全局：悬浮球 / 隐藏顶栏状态 ---------
let landscapeModeActive = false;

function applyToolbarHiddenMode(hidden) {
  const body = document.body;
  const fab = document.getElementById('fab');
  const fabPanel = document.getElementById('fab-panel');
  if (hidden) {
    body.classList.add('hide-toolbar');
    fab?.classList.add('visible');
  } else {
    body.classList.remove('hide-toolbar');
    fab?.classList.remove('visible');
    fabPanel?.classList.remove('open');
    fabPanel?.setAttribute('aria-hidden', 'true');
  }
  // 通知 Phaser 重算缩放
  setTimeout(() => triggerGameResize(), 40);
}

// --------- 同步 toolbar + fab-panel 的激活态 ---------
function syncActiveTool(type) {
  // 统一选中 toolbar + fab-panel 里对应的 data-type 按钮
  document.querySelectorAll('.tool-btn, .fab-btn[data-type]').forEach(b => {
    if (b.dataset.type) {
      if (selectedTool === type && b.dataset.type === type) b.classList.add('active');
      else b.classList.remove('active');
    }
  });
}

// --------- 通用:暂停/倍速/清理,保证 toolbar 和 fab-panel 两个按钮的文本状态同步 ---------
let currentSpeedLabel = '1X';
function syncPauseLabel(paused) {
  const want = paused ? 'PLAY' : 'PAUSE';
  document.querySelectorAll('#btn-pause span, #fab-btn-pause span').forEach(s => { s.textContent = want; });
}
function syncSpeedLabel() {
  document.querySelectorAll('#btn-speed span, #fab-btn-speed span').forEach(s => { s.textContent = currentSpeedLabel; });
}
function syncLandscapeLabel(text, finalReset) {
  document.querySelectorAll('#btn-landscape span, #fab-btn-landscape span').forEach(s => { s.textContent = text; });
  if (finalReset) {
    setTimeout(() => {
      document.querySelectorAll('#btn-landscape span, #fab-btn-landscape span').forEach(s => { s.textContent = 'LANDSCAPE'; });
    }, 3000);
  }
}
function clearLandscapeLoading() {
  document.querySelectorAll('#btn-landscape, #fab-btn-landscape').forEach(b => b.classList.remove('landscape-loading'));
}
function addLandscapeLoading() {
  document.querySelectorAll('#btn-landscape, #fab-btn-landscape').forEach(b => b.classList.add('landscape-loading'));
}

// --------- 横屏进入/退出 (提取公共函数, 保证点击横屏按钮优先执行 Fullscreen) ---------
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
function isInFullscreenNow() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);
}

// 参数 triggerEl: 用户点击的那个 DOM 元素 (用于保留原始文本 label)
async function toggleLandscapeMode(triggerEl) {
  if (triggerEl?.classList.contains('landscape-loading')) return;
  addLandscapeLoading();
  const origLabel = 'LANDSCAPE';

  try {
    const w = window.innerWidth, h = window.innerHeight;
    const currentlyLandscape = w > h || cssRotated;
    const inFs = isInFullscreenNow();
    const sO = screen?.orientation || screen?.mozOrientation || screen?.msOrientation;
    let orLockOk = false;
    try { orLockOk = !!(sO && (sO.type || '').startsWith('landscape')); } catch (e) {}

    // -------- 退出模式: 仅当我们自己的 landscapeModeActive 为 true 时才退出 --------
    //  (不要依赖系统原生 orientation/方向锁来判断, 否则桌面浏览器本来就是横屏会误判"已经在模式中"执行退出)
    if (landscapeModeActive) {
      try { if (sO?.unlock) await sO.unlock(); } catch (e) {}
      await exitFullscreenSafe();
      clearCssRotate();
      landscapeModeActive = false;
      applyToolbarHiddenMode(false);
      syncLandscapeLabel(origLabel, false);
      setTimeout(() => { checkOrientation(); triggerGameResize(); }, 50);
      clearLandscapeLoading();
      return;
    }

    // -------- 进入模式 (顺序: 先全屏, 再锁方向, 再 fallback CSS 旋转) --------
    const el = document.documentElement;
    const reqFs = el.requestFullscreen || el.webkitRequestFullscreen ||
                  el.mozRequestFullScreen || el.msRequestFullscreen;
    let wentFs = false;

    // 优先执行 Fullscreen (必须在用户手势内立即调用)
    if (reqFs && !inFs) {
      try { await reqFs.call(el); wentFs = true; }
      catch (e) { /* 忽略,继续尝试锁方向 */ }
    }
    await new Promise(r => setTimeout(r, 80));

    // 锁横屏方向
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
        if (!locked && sO.lockOrientation) {
          try { locked = !!sO.lockOrientation('landscape'); } catch (e) {}
        }
      }
    }
    await new Promise(r => setTimeout(r, 50));

    // 若方向锁失败, 再重试一次全屏(某些浏览器必须先全屏再锁)
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

    // 终极 fallback: CSS 强制旋转 (iOS Safari)
    if (!locked) {
      const w2 = window.innerWidth, h2 = window.innerHeight;
      if (h2 > w2) {
        applyCssRotate(false);
        setTimeout(() => triggerGameResize(), 200);
      }
    }

    // 用户明确点击了「横屏全屏」按钮:
    //   无论 Fullscreen API / Orientation Lock 是否成功, 都视为用户请求"沉浸式模式"
    //   → 立即隐藏顶栏, 显示悬浮球, 扩大游戏可视区域
    landscapeModeActive = true;
    applyToolbarHiddenMode(true);

    // 反馈 label (同时标注进入了哪个等级的成功)
    let mode = '';
    if (locked && wentFs) mode = 'FULL+ORIENT';
    else if (locked) mode = 'ORIENT LOCK';
    else if (wentFs) mode = 'FULLSCREEN';
    else if (cssRotated) mode = 'ROTATE';
    else mode = 'LANDSCAPE'; // 最基本: 隐藏了顶栏,进入沉浸式

    syncLandscapeLabel(mode, true);
    setTimeout(() => {
      clearLandscapeLoading();
    }, 900);

  } catch (err) {
    console.warn('Landscape error:', err);
    clearLandscapeLoading();
    syncLandscapeLabel(origLabel, false);
  }
}

function setupToolbar() {
  // -------- 类型选择按钮: 同时处理 toolbar 和 fab-panel --------
  function bindToolButton(btn) {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (!type) return;
      if (selectedTool === type) {
        selectedTool = null;
      } else {
        selectedTool = type;
      }
      syncActiveTool(selectedTool);
    });
  }
  document.querySelectorAll('.tool-btn').forEach(bindToolButton);
  document.querySelectorAll('.fab-btn[data-type]').forEach(bindToolButton);

  // -------- 暂停 / 倍速 / 清理 (两处按钮都绑定, 共享状态) --------
  function togglePause() {
    paused = !paused;
    syncPauseLabel(paused);
  }
  document.getElementById('btn-pause')?.addEventListener('click', togglePause);
  document.getElementById('fab-btn-pause')?.addEventListener('click', togglePause);

  const speeds = [1, 2, 3, 0.5];
  let speedIdx = 0;
  function toggleSpeed() {
    speedIdx = (speedIdx + 1) % speeds.length;
    gameSpeed = speeds[speedIdx];
    currentSpeedLabel = gameSpeed + 'X';
    syncSpeedLabel();
  }
  document.getElementById('btn-speed')?.addEventListener('click', toggleSpeed);
  document.getElementById('fab-btn-speed')?.addEventListener('click', toggleSpeed);

  function doClearAll() {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene) scene.clearAll();
  }
  document.getElementById('btn-clear')?.addEventListener('click', doClearAll);
  document.getElementById('fab-btn-clear')?.addEventListener('click', doClearAll);

  function doPurge() {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene) scene.clearZombies();
  }
  document.getElementById('btn-clear-zombies')?.addEventListener('click', doPurge);
  document.getElementById('fab-btn-clear-zombies')?.addEventListener('click', doPurge);

  // -------- 重置视角按钮 (两处都绑定) --------
  function doResetView() {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene && scene._resetCameraView) scene._resetCameraView();
  }
  document.getElementById('btn-resetview')?.addEventListener('click', doResetView);
  document.getElementById('fab-btn-resetview')?.addEventListener('click', doResetView);

  // -------- 横屏按钮 (两处都绑定到同一个 toggleLandscapeMode) --------
  const landscapeHandler = (ev) => toggleLandscapeMode(ev.currentTarget);
  document.getElementById('btn-landscape')?.addEventListener('click', landscapeHandler);
  document.getElementById('fab-btn-landscape')?.addEventListener('click', landscapeHandler);

  // -------- 悬浮球展开 / 收起面板 --------
  const fab = document.getElementById('fab');
  const fabPanel = document.getElementById('fab-panel');
  const fabClose = document.getElementById('fab-panel-close');

  function openFabPanel() {
    fabPanel?.classList.add('open');
    fabPanel?.setAttribute('aria-hidden', 'false');
  }
  function closeFabPanel() {
    fabPanel?.classList.remove('open');
    fabPanel?.setAttribute('aria-hidden', 'true');
  }
  fab?.addEventListener('click', () => {
    if (!fabPanel) return;
    if (fabPanel.classList.contains('open')) closeFabPanel();
    else openFabPanel();
  });
  fabClose?.addEventListener('click', closeFabPanel);
  // 点击面板外部(不包含悬浮球区域)关闭面板
  document.addEventListener('click', (e) => {
    if (!fabPanel?.classList.contains('open')) return;
    const t = e.target;
    if (fabPanel.contains(t) || fab?.contains(t)) return;
    closeFabPanel();
  });

  // -------- 监听全屏退出: 如果用户手动退出全屏也清理 --------
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evName => {
    document.addEventListener(evName, () => {
      const inFs = isInFullscreenNow();
      if (!inFs && landscapeModeActive && !cssRotated) {
        // 用户手动退出全屏 且没有CSS旋转 → 认为要退出横屏模式,恢复顶栏
        // (保留 orientation lock, 因为有些设备锁方向还在)
        landscapeModeActive = false;
        applyToolbarHiddenMode(false);
      }
      setTimeout(() => { checkOrientation(); triggerGameResize(); }, 100);
    });
  });

  // 键盘快捷键
  window.addEventListener('keydown', (e) => {
    const keyMap = { '1': 'survivor_male', '2': 'survivor_female', '3': 'zombie_normal', '4': 'zombie_fast', '5': 'zombie_tank' };
    if (keyMap[e.key]) {
      selectedTool = keyMap[e.key];
      syncActiveTool(selectedTool);
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    } else if (e.key === 'Escape') {
      selectedTool = null;
      syncActiveTool(null);
      closeFabPanel();
    }
  });

  // 桌面端: 初始也显示悬浮球(方便用户始终有小入口)
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                     (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isMobileUA) {
    fab?.classList.add('visible');
  }
}

// ============================================================
//  启动：所有类/函数定义完毕后, 执行 bootstrap
// ============================================================
bootstrap();
