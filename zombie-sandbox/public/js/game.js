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
    hp: 100, maxHp: 100, speed: 125, damage: 18,
    attackRange: 68, attackCooldown: 800,
    detectRange: 360, fleeRange: 150, aggression: 0.4,
    jumpPower: 520, weight: 1,
    color: PALETTE.green, accentColor: PALETTE.greenDark, skinColor: PALETTE.skin,
    // ===== 真实 sprite (每帧 100x100, 底部对齐) =====
    frameW: 100, frameH: 100,
    displayH: 108,
    // 物理 AABB 盒 (贴合人物真实轮廓 ≈ 身体宽高比 ~ 1:2.6, 脚底贴地面)
    bodyW: 22, bodyH: 58, bodyOffsetY: 0,
    assetDir: 'assets/sprites/survivor_male',
    // 每动作帧数: with Bottom Align (无阴影), 帧高100, 宽度= n*100
    frames: { Idle: 4, Walking: 8, Attack1: 8, Attack2: 8, Hurt: 4, Death: 6, Transform: 10 },
    size: 36
  },
  survivor_female: {
    name: 'FEMALE', category: 'survivor',
    hp: 85, maxHp: 85, speed: 140, damage: 14,
    attackRange: 62, attackCooldown: 700,
    detectRange: 400, fleeRange: 170, aggression: 0.25,
    jumpPower: 560, weight: 0.9,
    color: '#f472b6', accentColor: PALETTE.greenDarker, skinColor: PALETTE.skin,
    frameW: 100, frameH: 100,
    displayH: 104,
    bodyW: 20, bodyH: 54, bodyOffsetY: 0,
    assetDir: 'assets/sprites/survivor_female',
    frames: { Idle: 4, Walking: 8, Attack1: 8, Attack2: 8, Hurt: 4, Death: 6, Transform: 10 },
    size: 34
  },
  zombie_normal: {
    name: 'NORMAL', category: 'zombie',
    hp: 130, maxHp: 130, speed: 62, damage: 18,
    attackRange: 58, attackCooldown: 1000,
    detectRange: 400,
    jumpPower: 460, weight: 1.1,
    color: PALETTE.red, accentColor: PALETTE.redDark, skinColor: PALETTE.skinZ,
    frameW: 100, frameH: 100,
    displayH: 106,
    bodyW: 22, bodyH: 58, bodyOffsetY: 0,
    assetDir: 'assets/sprites/zombie_normal',
    // 僵尸只有一套 Attack (ZMeleeV1-Attack.png → Attack1, 无 Attack2), 两套 Death(Death=Death1, Death2=备用)
    frames: { Idle: 4, Walking: 8, Attack1: 7, Hurt: 4, Death: 6, Death2: 6 },
    size: 35
  },
  zombie_fast: {
    name: 'FAST', category: 'zombie',
    hp: 70, maxHp: 70, speed: 170, damage: 10,
    attackRange: 52, attackCooldown: 550,
    detectRange: 440,
    jumpPower: 600, weight: 0.8,
    color: '#f59e0b', accentColor: PALETTE.redDark, skinColor: PALETTE.skinZ,
    frameW: 100, frameH: 100,
    displayH: 100,
    bodyW: 19, bodyH: 52, bodyOffsetY: 0,
    assetDir: 'assets/sprites/zombie_fast',
    frames: { Idle: 4, Walking: 8, Attack1: 7, Hurt: 4, Death: 6, Death2: 6 },
    size: 33
  },
  zombie_tank: {
    name: 'TANK', category: 'zombie',
    hp: 420, maxHp: 420, speed: 40, damage: 40,
    attackRange: 76, attackCooldown: 1400,
    detectRange: 360,
    jumpPower: 400, weight: 1.8,
    color: PALETTE.red, accentColor: PALETTE.redDarker, skinColor: PALETTE.skinZ,
    // TANK 是 ZMeleeV1 × 1.5 放大, 每帧 150x150
    frameW: 150, frameH: 150,
    displayH: 156,
    bodyW: 38, bodyH: 92, bodyOffsetY: 0,
    assetDir: 'assets/sprites/zombie_tank',
    frames: { Idle: 4, Walking: 8, Attack1: 7, Hurt: 4, Death: 6, Death2: 6 },
    size: 52
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

    // ========== 预加载每个类型的 5~6 种 spritesheet (每帧 100x100) ==========
    Object.keys(ENTITY_CONFIG).forEach(type => {
      const cfg = ENTITY_CONFIG[type];
      const actions = Object.keys(cfg.frames);
      actions.forEach(action => {
        const key = `${type}_${action}`;             // e.g. survivor_male_Walking
        const url = `${cfg.assetDir}/${action}.png`; // e.g. assets/sprites/survivor_male/Walking.png
        const frames = cfg.frames[action];
        const sheetW = frames * cfg.frameW;
        this.load.spritesheet(key, url, {
          frameWidth: cfg.frameW, frameHeight: cfg.frameH,
          endFrame: frames - 1, margin: 0, spacing: 0
        });
      });
    });
  }

  create() {
    // ========== 注册每个类型的 Phaser 动画: idle / walk / attack1 / attack2 / hurt / death / transform / death2 ==========
    Object.keys(ENTITY_CONFIG).forEach(type => {
      const cfg = ENTITY_CONFIG[type];
      const anims = this.anims;

      const mk = (action, frameRate, repeat = -1) => {
        const key = `${type}_${action}`;
        if (!this.textures.exists(key)) return;
        const frames = cfg.frames[action] || 1;
        const keyAnim = `${type}:${action.toLowerCase()}`;
        if (anims.exists(keyAnim)) return;
        anims.create({
          key: keyAnim,
          frames: anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
          frameRate, repeat
        });
      };
      mk('Idle',     cfg.category === 'zombie' ? 2.2 : 3.0);
      mk('Walking',  cfg.category === 'zombie_fast' ? 9.0
                    : cfg.category === 'zombie'      ? 5.5
                    : cfg.category === 'survivor'    ? 8.5 : 6.5);
      mk('Attack1',  9.5, 0);
      mk('Attack2',  9.5, 0);       // 仅生还者, zombie 纹理不存在, mk 内会跳过
      mk('Hurt',     7.0, 0);
      mk('Death',    6.0, 0);
      mk('Death2',   6.0, 0);       // 僵尸备用死亡 (爆头/暴击)
      mk('Transform', 5.5, 0);      // 仅生还者: 死亡→僵尸化转变, 播1次
    });

    // ========== 占位/UI 纹理 (保留) ==========
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

    // ====== 摄像机: 缩放按钮 (toolbar + 悬浮球) ======
    this._zoomByButton = (factor) => {
      const cam = this.cameras.main;
      const MIN_Z = GameScene.MIN_ZOOM, MAX_Z = GameScene.MAX_ZOOM;
      this.zoomAtScreenPoint(this.scale.width / 2, this.scale.height / 2, factor, MIN_Z, MAX_Z);
    };
    this._zoomIn = () => this._zoomByButton(1.25);
    this._zoomOut = () => this._zoomByButton(1 / 1.25);

    // ====== 摄像机: 虚拟方向键 (D-PAD) 长按状态 ======
    this._camDPadHeld = { up: false, down: false, left: false, right: false, center: false };
    this._dpadPanSpeed = 40; // 比键盘 WASD 快一点（触控一次按久一点）
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

    // Arcade 物理本地化: 确保 staticGroup 的碰撞 Sprite 具备真实碰撞尺寸
    // setSize/refreshBody 依赖 sprite.texture.source 的尺寸，所以直接建对应尺寸的 canvas texture
    const ensureSizeTexture = (key, w, h) => {
      if (this.textures.exists(key)) return key;
      const cv = this.textures.createCanvas(key, Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
      const ctx = cv.getContext();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      cv.refresh();
      return key;
    };
    this._ensureSizeTex = ensureSizeTexture;

    this.groundHeight = GROUND_H;
    this.groundGroup = this.physics.add.staticGroup();
    this.groundLayer = this.add.container(0, 0);
    this.groundLayer.setDepth(-2);
    this.rebuildGround(WORLD_W, WORLD_H);

    // 侧墙（世界边界两侧,比世界略高,防止跳出）
    this.sideWalls = this.physics.add.staticGroup();
    const t = 40;
    const wallH = WORLD_H * 1.4;
    ensureSizeTexture('__sw_wall', t, wallH);
    this.sideWalls.create(-t / 2, WORLD_H / 2, '__sw_wall').setVisible(false);
    this.sideWalls.create(WORLD_W + t / 2, WORLD_H / 2, '__sw_wall').setVisible(false);

    this.platformGroup = this.physics.add.staticGroup();
    this.platformLayer = this.add.container(0, 0);
    this.platformLayer.setDepth(-1);
    this.rebuildPlatforms(WORLD_W, WORLD_H);
  }

  rebuildGround(w, h) {
    const gh = this.groundHeight;
    this.groundGroup.clear(true, true);
    this.groundLayer.removeAll(true);
    // 关键: texture 尺寸本身就是 (w, gh)，让 Static Body 默认大小就是碰撞大小
    const tex = this._ensureSizeTex ? this._ensureSizeTex('__gr', w, gh) : null;
    this.groundGroup.create(w / 2, h - gh / 2, tex || null).setVisible(false);

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
    top.fillStyle(0x14532d, 1);
    top.fillRect(0, h - gh, w, 8);
    top.fillStyle(PALETTE.green, 0.85);
    top.fillRect(0, h - gh, w, 2);
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
      // texture 尺寸本身 = (pw, ph) — Static Body 大小就是碰撞体大小
      const texKey = this._ensureSizeTex ? this._ensureSizeTex(`__p_${d.pw}_${d.ph}`, d.pw, d.ph) : null;
      this.platformGroup.create(cx, cy, texKey || null).setVisible(false);
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

    // 触摸 / 鼠标按键统一判断（与 buildInputHandlers 同定义）
    const isPrimaryDown = (p) => {
      if (!p) return false;
      if (typeof p.primaryDown === 'boolean') return p.primaryDown;
      if (p.pointerType === 'touch' || p.pointerType === 'pen') return p.active && p.buttons !== 0;
      return !!(p.leftButtonDown && p.leftButtonDown());
    };
    const isSecondaryDown = (p) => (p && p.pointerType === 'mouse') &&
      (!!(p.rightButtonDown && p.rightButtonDown()) || p.button === 2);
    const isMiddleDown = (p) => (p && p.pointerType === 'mouse') &&
      (!!(p.middleButtonDown && p.middleButtonDown()) || p.button === 1);

    // pointer 是否落在 HTML UI 上（兼容移动端/CSS横屏旋转）
    const isPointerInUI = (p) => {
      if (typeof document === 'undefined') return false;
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const cRect = canvas.getBoundingClientRect();
      const isTouchLike = p.pointerType === 'touch' || p.pointerType === 'pen';
      const forceLandscape = document.body.classList.contains('force-landscape');

      if (isTouchLike || forceLandscape) {
        const topHidden = document.body.classList.contains('hide-toolbar');
        if (!topHidden) {
          const toolbarH = document.getElementById('toolbar')?.offsetHeight || 60;
          if (p.y < toolbarH) return true;
        }
        const canvasCx = (p.x * cRect.width / this.scale.width) + cRect.left;
        const canvasCy = (p.y * cRect.height / this.scale.height) + cRect.top;
        const hitRect = (r) => r && canvasCx >= r.left && canvasCx <= r.right && canvasCy >= r.top && canvasCy <= r.bottom;
        const fab = document.getElementById('fab');
        if (fab && hitRect(fab.getBoundingClientRect())) return true;
        const panel = document.getElementById('fab-panel');
        if (panel && panel.classList.contains('open') && hitRect(panel.getBoundingClientRect())) return true;
        const statusBar = document.getElementById('status-bar');
        if (statusBar && hitRect(statusBar.getBoundingClientRect())) return true;
        return false;
      }

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

    // --- 拖动 (桌面:右键/中键/无工具左键; 手机:没选中工具时单指拖动) ---
    let isDragging = false;
    let dragStartCam = null;
    let dragStartPointer = null;

    this.input.on('pointerdown', (pointer) => {
      const isLeft = isPrimaryDown(pointer);
      const isRight = isSecondaryDown(pointer);
      const isMid = isMiddleDown(pointer);
      const isTouch = pointer.pointerType === 'touch' || pointer.pointerType === 'pen';
      // 桌面: 右键/中键/无工具时左键；  触摸/笔: 无选中工具时直接拖动
      const wantDrag = isRight || isMid ||
        (!selectedTool && isLeft) ||
        (isTouch && !selectedTool);
      if (!wantDrag) { isDragging = false; return; }
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
      const p0 = this.input.pointers && this.input.pointers[0];
      const p1 = this.input.pointers && this.input.pointers[1];
      if (p0 && p1 && p0.active && p1.active && p0.x != null && p1.x != null) {
        pinchStartDist = Phaser.Math.Distance.Between(p0.x, p0.y, p1.x, p1.y);
        pinchStartZoom = cam.zoom;
        pinchStartCX = (p0.x + p1.x) / 2;
        pinchStartCY = (p0.y + p1.y) / 2;
      }
    });
    this.input.on('pointermove', () => {
      const p0 = this.input.pointers && this.input.pointers[0];
      const p1 = this.input.pointers && this.input.pointers[1];
      if (!pinchStartDist || !p0 || !p1 || !p0.active || !p1.active || p0.x == null || p1.x == null) return;
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

  // ---- 输入：点击/触摸放置（屏幕坐标→世界坐标,含防抖+防误触）----
  buildInputHandlers() {
    const WORLD_W = GameScene.WORLD_W, WORLD_H = GameScene.WORLD_H;
    const getTopOffset = () => document.getElementById('toolbar')?.offsetHeight || 60;
    const isFabPanelOpen = () => document.getElementById('fab-panel')?.classList.contains('open');

    // 触摸 / 鼠标按键统一判断（兼容手机端 pointer 没有 leftButtonDown）
    // Phaser 的 pointerType: 'mouse' | 'touch' | 'pen'
    const isPrimaryDown = (p) => {
      if (!p) return false;
      if (typeof p.primaryDown === 'boolean') return p.primaryDown;
      if (p.pointerType === 'touch' || p.pointerType === 'pen') return p.active && p.buttons !== 0;
      return !!(p.leftButtonDown && p.leftButtonDown());
    };
    const isSecondaryDown = (p) => {
      if (!p || p.pointerType !== 'mouse') return false;
      return !!(p.rightButtonDown && p.rightButtonDown()) || (p.button === 2);
    };
    const isMiddleDown = (p) => {
      if (!p || p.pointerType !== 'mouse') return false;
      return !!(p.middleButtonDown && p.middleButtonDown()) || (p.button === 1);
    };

    // 检测当前指针位置是否在 HTML UI 上
    // 桌面端: 使用 elementFromPoint 精确命中
    // 移动端 (含CSS强制横屏rotate): 只用几何判断, 不调用 elementFromPoint (因为坐标被 rotate 错位)
    const isPointerInHtmlUI = (p) => {
      if (typeof document === 'undefined') return false;
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const cRect = canvas.getBoundingClientRect();
      const isTouchLike = p.pointerType === 'touch' || p.pointerType === 'pen';
      const forceLandscape = document.body.classList.contains('force-landscape');

      if (isTouchLike || forceLandscape) {
        // 移动端/横屏旋转模式: 用几何规则判断, 不用 elementFromPoint
        // 1. toolbar 顶栏 (除非已隐藏)
        const topHidden = document.body.classList.contains('hide-toolbar');
        if (!topHidden) {
          const toolbarH = document.getElementById('toolbar')?.offsetHeight || 60;
          if (p.y < toolbarH) return true;
        }
        // 2. 悬浮球 FAB (圆形) 左上角
        const fab = document.getElementById('fab');
        if (fab) {
          const fRect = fab.getBoundingClientRect();
          // fRect 是 DOM 里的 CSS 像素坐标（含 rotate）, 需要转换到 canvas 内部坐标系不现实
          // 直接看屏幕坐标是否落在 FAB DOM 矩形内 (clientX/Y)
          const cx = (p.x * cRect.width / this.scale.width) + cRect.left;
          const cy = (p.y * cRect.height / this.scale.height) + cRect.top;
          if (cx >= fRect.left && cx <= fRect.right && cy >= fRect.top && cy <= fRect.bottom) return true;
        }
        // 3. 悬浮面板 (打开状态)
        const panel = document.getElementById('fab-panel');
        if (panel && panel.classList.contains('open')) {
          const pRect = panel.getBoundingClientRect();
          const cx = (p.x * cRect.width / this.scale.width) + cRect.left;
          const cy = (p.y * cRect.height / this.scale.height) + cRect.top;
          if (cx >= pRect.left && cx <= pRect.right && cy >= pRect.top && cy <= pRect.bottom) return true;
        }
        // 4. 底部状态栏
        const statusBar = document.getElementById('status-bar');
        if (statusBar) {
          const sRect = statusBar.getBoundingClientRect();
          const cx = (p.x * cRect.width / this.scale.width) + cRect.left;
          const cy = (p.y * cRect.height / this.scale.height) + cRect.top;
          if (cx >= sRect.left && cx <= sRect.right && cy >= sRect.top && cy <= sRect.bottom) return true;
        }
        return false;
      }

      // 桌面端 / 非旋转模式: 原 elementFromPoint 方案
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
    let lastPointerDown = null;   // fallback: 最后一次 pointerdown 信息
    let startedDragCam = false;   // 此次 pointerdown 是否触发了摄像机拖拽
    const PLACE_MIN_INTERVAL = 120;
    const MOVE_TOLERANCE = 18;    // 手机端手指点击有轻微滑动, 放宽 12→18

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
      lastPointerDown = { x: pointer.x, y: pointer.y, id: pointer.id, ts: Date.now(), tool: selectedTool, type: pointer.pointerType };
      if (isPointerInHtmlUI(pointer)) return;
      // 兼容触摸: 鼠标用 LBD, 触摸用 primaryDown
      const isLeft = isPrimaryDown(pointer);
      const isRight = isSecondaryDown(pointer);
      const isMid = isMiddleDown(pointer);
      const isTouch = pointer.pointerType === 'touch' || pointer.pointerType === 'pen';
      const leftNoTool = !selectedTool && isLeft;
      // 触摸 / 笔 时, 如果没选中工具 → 拖动摄像机 (体验同桌面右键)
      const touchNoTool = isTouch && !selectedTool;
      const wantDrag = isRight || isMid || leftNoTool || touchNoTool;
      if (wantDrag) {
        startedDragCam = true;
        return;
      }
      // 选中工具 + 左键/触摸主按钮 = 放置尝试
      if (selectedTool && isLeft) {
        touchStartPos = { x: pointer.x, y: pointer.y, id: pointer.id, ts: Date.now() };
      }
    });
    this.input.on('pointerup', (pointer) => {
      if (startedDragCam) { startedDragCam = false; return; }
      let doPlace = false;
      // 路径 A: 有明确的 touchStartPos 记录 (优先用)
      if (touchStartPos && touchStartPos.id === pointer.id) {
        const dx = Math.abs(pointer.x - touchStartPos.x);
        const dy = Math.abs(pointer.y - touchStartPos.y);
        touchStartPos = null;
        if (dx < MOVE_TOLERANCE && dy < MOVE_TOLERANCE) doPlace = true;
      }
      // 路径 B: fallback (手机端某些机型 leftButtonDown/primaryDown 仍返回 false 时)
      // 条件: 选中工具 & 最后一次 pointerdown 有值 & 距离近 & 距离时间 < 500ms & id 一致 & 没有 UI 命中
      if (!doPlace && selectedTool && lastPointerDown && lastPointerDown.id === pointer.id) {
        const dt = Date.now() - lastPointerDown.ts;
        const dx = Math.abs(pointer.x - lastPointerDown.x);
        const dy = Math.abs(pointer.y - lastPointerDown.y);
        if (dt < 500 && dx < MOVE_TOLERANCE && dy < MOVE_TOLERANCE && !isPointerInHtmlUI(pointer)) {
          doPlace = true;
        }
      }
      lastPointerDown = null;
      touchStartPos = null;
      if (doPlace) onPlace(pointer);
    });
    this.input.on('pointerupoutside', () => { touchStartPos = null; lastPointerDown = null; startedDragCam = false; });

    // 预览: 把屏幕坐标->世界坐标,跟随鼠标/手指
    this.input.on('pointermove', (pointer) => {
      const cam = this.cameras.main;
      if (!this.placementPreview) {
        // 用真实 Idle 精灵第 0 帧作为预览, 脚底对齐 + 缩放一致
        const dummyCfg = ENTITY_CONFIG['survivor_male'];
        this.placementPreview = this.add.image(0, 0, 'survivor_male_Idle', 0)
          .setAlpha(0.5).setDepth(999)
          .setOrigin(0.5, 1.0)
          .setScale(dummyCfg.displayH / dummyCfg.frameH);
        this.placementPreviewLine = this.add.arc(0, 0, 0).setStrokeStyle(1, PALETTE.text, 0.15).setDepth(998);
        this._prevType = null;
      }
      if (selectedTool && !isPointerInHtmlUI(pointer)) {
        const worldPt = cam.getWorldPoint(pointer.x, pointer.y);
        const groundTopY = WORLD_H - this.groundHeight;
        const cfg = ENTITY_CONFIG[selectedTool];
        // 预览点 y 是脚底位置, 所以最低只能是 cfg.bodyH(脚底到头顶至少能看到身体), 最高 groundTopY - 1(脚站地面上)
        const minY = Math.max(cfg.bodyH + 10, cfg.displayH * 0.7);
        const prevY = Phaser.Math.Clamp(worldPt.y, minY, groundTopY - 1);
        const prevX = Phaser.Math.Clamp(worldPt.x, cfg.displayH * 0.5, WORLD_W - cfg.displayH * 0.5);
        // 切工具类型时同步改预览贴图 + 缩放 + origin
        if (this._prevType !== selectedTool) {
          this._prevType = selectedTool;
          const sheetKey = `${selectedTool}_Idle`;
          if (this.textures.exists(sheetKey)) {
            this.placementPreview.setTexture(sheetKey, 0);
            const c = ENTITY_CONFIG[selectedTool];
            this.placementPreview.setScale(c.displayH / c.frameH);
          }
        }
        this.placementPreview.setVisible(true);
        this.placementPreview.setPosition(prevX, prevY);
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
    // ====== 用 spritesheet 的第一帧作为 sprite 初始显示 (texture = type_Walking 或 type_Idle 都可以) ======
    const startSheetKey = `${type}_Idle`;
    ent.sprite = this.physics.add.sprite(x, y, startSheetKey, 0);
    ent.sprite.setCollideWorldBounds(true);
    ent.sprite.setBounce(0.02, 0.02);
    ent.sprite.setDepth(10);
    // 按 displayH/frameH 比例缩放显示, 宽度随 1:1 帧保持比例
    const scale = cfg.displayH / cfg.frameH;
    ent.sprite.setScale(scale);
    // 脚底对齐 (sprite 底部就是 y, origin = (0.5, 1.0))
    ent.sprite.setOrigin(0.5, 1.0);

    // AABB 盒碰撞体 (按 cfg.bodyW × cfg.bodyH, 身体中心在 y - bodyH/2 - bodyOffsetY 下方
    // body 坐标 = sprite 底部 (x,y) 上方 bodyH, 因此 body.top = y - bodyH)
    ent.sprite.body.setSize(cfg.bodyW, cfg.bodyH, false);
    // offset (sprite 坐标以 origin=(0.5,1) 计算时; body 默认是按 displayWidth/2 中心, 我们手动调)
    const dw = ent.sprite.displayWidth;
    const dh = ent.sprite.displayHeight;
    // body 中心在 sprite 底部上方 (bodyH/2 + bodyOffsetY)
    const offX = (dw - cfg.bodyW) / 2;                 // 水平居中
    const offY = (dh - cfg.bodyH) - cfg.bodyOffsetY;   // 底部留 bodyOffsetY 像素空隙, 让 body 在脚上方
    ent.sprite.body.setOffset(offX, offY);
    ent.sprite.body.mass = cfg.weight;

    ent.type = type; ent.cfg = cfg;
    ent.hp = cfg.hp; ent.maxHp = cfg.maxHp;
    ent.isDead = false;
    ent.lastAttack = 0; ent.target = null; ent.aggroTimer = 0;
    ent.wanderDir = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    ent.wanderTimer = 0;
    ent.hitFlash = 0;
    ent.jumpCooldown = 0;
    ent._attackAnimUntil = 0; // 攻击动画播放完之前不切回 walk/idle
    ent._hurtAnimUntil = 0;

    // 血条 & 名称 基于 sprite 脚底位置 (y) 和 displayH
    const hpBarY = y - cfg.displayH - 6;
    const nameY  = y - cfg.displayH - 18;
    ent.hpBarBg = this.add.image(x, hpBarY, 'hpBarBg').setDepth(20);
    ent.hpBar = this.add.image(x - 21, hpBarY, 'hpBarGreen').setDepth(21);
    ent.hpBar.setOrigin(0.05, 0.5);
    ent.hpBarBg.setOrigin(0.5, 0.5);

    ent.nameTag = this.add.text(x, nameY, cfg.name, {
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

    // 默认播放 idle
    const idleKey = `${type}:idle`;
    if (this.anims.exists(idleKey)) ent.sprite.play(idleKey);

    this.entities.push(ent);
    this.updateStats(true);
    return ent;
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
    const cam = this.cameras.main;
    const z = cam.zoom;
    const WORLD_W = GameScene.WORLD_W, WORLD_H = GameScene.WORLD_H;
    let dx = 0, dy = 0;

    // 1) 物理键盘 (WASD/方向键)
    if (this._wasdKeys) {
      const pxPerFrame = this._camPanSpeed * (delta / 16.67);
      const worldStep = pxPerFrame / z;
      if (this._wasdKeys.left.isDown) dx -= worldStep;
      if (this._wasdKeys.right.isDown) dx += worldStep;
      if (this._wasdKeys.up.isDown) dy -= worldStep;
      if (this._wasdKeys.down.isDown) dy += worldStep;
      if (this._wasdKeys.resetView.isDown && this._resetCameraView) this._resetCameraView();
    }

    // 2) 虚拟方向键 D-PAD (手机端长按)
    if (this._camDPadHeld) {
      const pxPerFrame = (this._dpadPanSpeed || 40) * (delta / 16.67);
      const worldStep = pxPerFrame / z;
      if (this._camDPadHeld.left) dx -= worldStep;
      if (this._camDPadHeld.right) dx += worldStep;
      if (this._camDPadHeld.up) dy -= worldStep;
      if (this._camDPadHeld.down) dy += worldStep;
      if (this._camDPadHeld.center && this._resetCameraView) {
        // center 不一直 reset，只触发一次 (由 DOM handler 设 true 后这里立即还原)
        this._resetCameraView();
        this._camDPadHeld.center = false;
      }
    }

    if (dx || dy) {
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX + dx, 0, Math.max(0, WORLD_W - this.scale.width / z));
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, Math.max(0, WORLD_H - this.scale.height / z));
    }

    if (paused) return;

    // ========== 战斗/AI / 特效 ==========
    const dt = (delta / 16.666) * gameSpeed;
    const now = time * gameSpeed + (this._timeOffset || 0);
    this._timeOffset = (this._timeOffset || 0) + delta * (gameSpeed - 1);

    this.entities.forEach(ent => {
      if (ent.isDead) return;
      this.updateEntityAI(ent, now, dt, time);
      this.updateEntityVisuals(ent, time);
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
    const GRAVITY = 900; // 与全局 physics.arcade.gravity.y 保持一致
    // 该角色能跳到的最大高度 (用于判断是否能跳上平台追上目标)
    const maxJumpH = cfg.jumpPower ? (cfg.jumpPower * cfg.jumpPower) / (2 * GRAVITY) : 90;
    const entBody = ent.sprite.body;

    let nearestEnemy = null;
    let nearestDist = Infinity;
    let nearestDx = 0;
    let nearestDy = 0;

    this.entities.forEach(other => {
      if (other === ent || other.isDead) return;
      if (other.cfg.category === cfg.category) return;
      const dx = other.sprite.x - ent.sprite.x;
      const dy = other.sprite.y - ent.sprite.y;
      const d = Math.hypot(dx, dy);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = other; nearestDx = dx; nearestDy = dy; }
    });

    ent.target = (nearestEnemy && nearestDist <= cfg.detectRange) ? nearestEnemy : null;
    const hasTarget = !!ent.target;

    let dirX = 0; // -1,0,1
    let tryJump = false;

    const onGround = entBody.blocked.down || entBody.touching.down;
    // 站在平台/地上时 blocked.down=true；body.velocity.y 判断空中状态
    const inAir = !onGround && Math.abs(entBody.velocity.y) > 5;
    ent.jumpCooldown = Math.max(0, ent.jumpCooldown - dt);

    // ---- 自动跳平台检测：向前方检测"悬空就跳" + "下方将坠落就停"
    if (onGround && ent.jumpCooldown === 0 && !inAir && Math.abs(dirX || ent.wanderDir) > 0) {
      const ahead = (dirX || ent.wanderDir);
      if (ahead !== 0) {
        // 角色前方约 1/3 jump 距离的点, 是否有平台 (无则视为将掉落 → 跳一下跨过去 / 或停)
        const probeX = ent.sprite.x + ahead * Math.max(28, cfg.size * 1.6);
        const probeY = ent.sprite.y + cfg.size * 0.8;
        // 简化: 用 tileBias 已在 Physics, 这里只判断是否在某平台顶部坐标附近 + 同Y层范围
        // 更稳健: 直接用 physics.world.overlapRect 检测 (静态body)
        const rect = new Phaser.Geom.Rectangle(probeX - 4, probeY - 2, 8, 10);
        const onSolid = Phaser.Physics.Arcade.ArcadePhysics.prototype.StaticBody &&
          this.physics.staticGroupCollideCallback; // unused placeholder, fallback below
        // 用简单的 Y 阈值代替: 如果 probe 在 groundTop 之下视为在地面
        const groundTopY = GameScene.WORLD_H - this.groundHeight;
        const onGroundAhead = probeY >= groundTopY - 4;
        // 下方不是地面且没有任何静态body: 不跳会掉下去 - 如果落差太大(>80)则原地停
        if (!onGroundAhead) {
          // 检查是否有平台在 probe 附近 y
          const pw = ent.sprite.x + ahead * 45;
          const maxPlatformY = ent.sprite.y + cfg.size * 0.6;
          const minPlatformY = maxPlatformY - (maxJumpH * 0.55); // 可以跳上 55% 最大高度
          let platformAhead = false;
          this.platformGroup.getChildren().forEach(p => {
            if (!platformAhead) {
              const b = p.body;
              if (!b) return;
              const left = p.x - b.halfWidth;
              const right = p.x + b.halfWidth;
              const top = p.y - b.halfHeight;
              if (pw >= left - 6 && pw <= right + 6 &&
                  top <= maxPlatformY + 14 && top >= minPlatformY - 14) {
                platformAhead = true;
              }
            }
          });
          // 前方有平台高度在跳得到的范围内 → 跳上去
          if (platformAhead) tryJump = true;
          // 没有地面也没有平台,前方是悬崖, 但落差>120 → 掉头防止摔死
          if (!platformAhead && !onGroundAhead) {
            const cliffDrop = groundTopY - (probeY + cfg.size);
            if (cliffDrop > 120) {
              dirX = 0;
              ent.wanderDir = -ent.wanderDir; // 掉头
            }
          }
        }
      }
    }

    if (cfg.category === 'survivor') {
      if (hasTarget) {
        const d = nearestDist;
        const enemy = ent.target;
        const dxSign = Math.sign(nearestDx) || 1;

        if (d < cfg.attackRange + 6) {
          this.tryAttack(ent, enemy, now, realTime);
          dirX = 0;
        } else if (d < cfg.fleeRange && Math.random() > cfg.aggression) {
          dirX = -dxSign;
        } else if (d < cfg.detectRange && Math.random() < cfg.aggression + 0.1) {
          dirX = dxSign;
        } else {
          const ideal = (cfg.fleeRange + cfg.detectRange) / 2;
          dirX = d < ideal ? -dxSign : dxSign;
        }
        // 被追上/目标在上方时跳跃逃生或跳平台追击
        if (onGround && ent.jumpCooldown === 0) {
          const targetAboveMe = nearestDy < -30; // 目标在上方(在平台上)
          const targetBelow = nearestDy > 40;
          const canReachH = -nearestDy - 6 < maxJumpH;
          const closeEnough = d < Math.max(260, cfg.detectRange * 0.7);
          if (
            (d < cfg.fleeRange * 0.7 && Math.random() < 0.03 * dt) ||
            (targetAboveMe && canReachH && closeEnough)
          ) {
            tryJump = true;
          }
          if (targetBelow && closeEnough && dirX !== 0 && Math.random() < 0.02 * dt) tryJump = true;
        }
      } else {
        dirX = ent.wanderDir;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          const r = Math.random();
          ent.wanderDir = r < 0.35 ? -1 : (r < 0.7 ? 1 : 0);
          ent.wanderTimer = 80 + Math.random() * 240;
        }
        // 游走时偶尔跳
        if (onGround && ent.jumpCooldown === 0 && Math.random() < 0.008 * dt) {
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
        // 丧尸积极跳跃: 目标上方有高度差 → 跳追
        if (onGround && ent.jumpCooldown === 0) {
          const canReachH = -nearestDy - 6 < maxJumpH;
          const targetAbove = nearestDy < -24;
          const close = d < Math.max(280, cfg.detectRange * 0.6);
          if (targetAbove && canReachH && close) tryJump = true;
          else if (Math.random() < 0.012 * dt && d < 260) tryJump = true;
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
      ent.jumpCooldown = Math.max(16, 24 + Math.random() * 8);
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

    // ===== 播放攻击动画 (Attack1 或 Attack2) =====
    const cfg = attacker.cfg;
    const has2 = !!cfg.frames.Attack2;
    const atkName = (has2 && Math.random() < 0.35) ? 'attack2' : 'attack1';
    const animKey = `${attacker.type}:${atkName}`;
    if (this.anims.exists(animKey)) {
      attacker.sprite.play(animKey, true); // ignoreIfPlaying=false, 重启动画
      const frames = atkName === 'attack2' ? cfg.frames.Attack2 : cfg.frames.Attack1;
      const frameRate = 9.5;
      attacker._attackAnimUntil = now + (frames / frameRate) * 1000;
    }
  }

  dealDamage(entity, dmg, attacker, realTime) {
    entity.hp -= dmg;
    entity.hitFlash = 20;
    const by = entity.sprite.y - entity.cfg.displayH;
    this.showDamageNumber(entity.sprite.x, by + 4, dmg, attacker.cfg.category === 'zombie');
    // ===== 受伤动画: 必播, 优先级高于攻击 (被打中立刻疼一下) =====
    if (!entity.isDead) {
      const hurtKey = `${entity.type}:hurt`;
      if (this.anims.exists(hurtKey)) {
        entity.sprite.play(hurtKey, true); // true = ignoreIfPlaying = 重启动画, 保证每次命中都播
        const frames = entity.cfg.frames.Hurt || 4;
        entity._hurtAnimUntil = realTime + (frames / 7) * 1000;
        entity._attackAnimUntil = 0;      // 受伤打断正在挥砍的攻击动画
      }
    }
    if (entity.hp <= 0) this.killEntity(entity, attacker, realTime);
  }

  // ===== 人类 → 僵尸的映射关系 (被僵尸咬死后感染变成什么) =====
  // MeleeV1(MALE) 对应 ZMeleeV1 (normal zombie), MeleeV2(FEMALE) 对应 ZMeleeV2 (fast zombie)
  _survivorToZombie(survivorType) {
    switch (survivorType) {
      case 'survivor_male':   return 'zombie_normal';
      case 'survivor_female': return 'zombie_fast';
      default: return null;
    }
  }

  killEntity(entity, attacker = null, realTime = performance.now()) {
    entity.isDead = true;
    entity.sprite.setVelocityX(0);
    entity.sprite.setDepth(5);
    if (entity.sprite.body) entity.sprite.body.enable = false;
    entity.hpBar.destroy();
    entity.hpBarBg.destroy();
    entity.nameTag.destroy();

    const cfg = entity.cfg;
    const willInfect = (cfg.category === 'survivor'
                        && attacker && attacker.cfg && attacker.cfg.category === 'zombie');

    // ===== 死亡动画: 人类被感染时 death → transform → 复活成 zombie; 否则 death → dim + 尸体块 =====
    const deathAnimKey = `${entity.type}:death`;
    const transformAnimKey = `${entity.type}:transform`;
    const hasDeath = this.anims.exists(deathAnimKey);
    const hasTransform = willInfect && this.anims.exists(transformAnimKey);

    // 清理旧的 animationcomplete 监听器避免多次触发
    entity.sprite.removeAllListeners('animationcomplete');

    const finishDeathNormally = () => {
      entity.sprite.setTint(PALETTE.muted);
      // 尸体阴影块 (贴合脚底)
      const cg = this.add.graphics();
      cg.fillStyle(PALETTE.black, 0.5);
      cg.fillRect(-cfg.size, -cfg.size * 0.25, cfg.size * 2, cfg.size * 0.5);
      cg.setPosition(entity.sprite.x, entity.sprite.y - cfg.displayH * 0.1);
      cg.setDepth(4);
      this.corpses.push({ sprite: entity.sprite, gfx: cg });
      entity._corpseGfx = cg;
    };

    if (hasDeath) {
      entity.sprite.setTint(0xffffff);
      entity.sprite.play(deathAnimKey, true);
    } else {
      entity.sprite.setTint(PALETTE.muted);
      entity.sprite.setAngle(90);
    }

    if (hasTransform) {
      // 人类感染流程: death 播完 → transform → spawn zombie
      const zombify = () => {
        const zType = this._survivorToZombie(entity.type);
        if (!zType) { finishDeathNormally(); return; }
        // 先播 transform 动画 (生还者 -> 丧尸 转变过程)
        entity.sprite.clearTint();
        entity.sprite.play(transformAnimKey, true);
        entity.sprite.once('animationcomplete', () => {
          // 转变完成: 销毁旧 sprite/corpses 记录, 在同位置生成新 zombie, 脚对齐 y
          const spawnX = entity.sprite.x;
          const spawnY = entity.sprite.y; // transform 的 origin 仍是 (0.5,1.0), y 是脚底
          // 清理尸体阴影块(如果有)
          if (entity._corpseGfx) { entity._corpseGfx.destroy?.(); entity._corpseGfx = null; }
          // 从 corpses 里把自己去掉 (如果 death 阶段加进去了)
          this.corpses = this.corpses.filter(c => c.sprite !== entity.sprite);
          // 销毁实体 sprite / UI (hpBar 已在上面销毁, 但防意外再 destroy 一次)
          entity.sprite.destroy();
          this.stats.dead -= 1; // 这是"复活"不算真死
          // 生成新 zombie (HP 满的, 属于僵尸阵营)
          const newZombie = this.spawnEntity(zType, spawnX, spawnY);
          if (newZombie) {
            // 新 zombie 朝最近的 survivor
            newZombie.wanderDir = (attacker && attacker.sprite.x < spawnX) ? -1 : 1;
            // 刚变完给 0.7s 无敌 + 屏幕抖一下
            newZombie.sprite.setAlpha(0.95);
          }
          this.updateStats(true);
        });
      };
      if (hasDeath) {
        entity.sprite.once('animationcomplete', (anim) => {
          if (`${entity.type}:death` === anim?.key) zombify();
        });
      } else {
        zombify();
      }
    } else {
      // 非感染: death 完变灰
      if (hasDeath) {
        entity.sprite.once('animationcomplete', () => finishDeathNormally());
      } else {
        finishDeathNormally();
      }
    }

    const idx = this.entities.indexOf(entity);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  showAttackEffect(attacker, defender) {
    const fx = this.add.graphics();
    fx.lineStyle(1, attacker.cfg.color, 1);
    fx.beginPath();
    // 基于显示高度: 攻击起点 ≈ 人物胸部 (displayH * 0.55 上方)
    const ax = attacker.sprite.x;
    const ay = attacker.sprite.y - attacker.cfg.displayH * 0.55;
    const dx = defender.sprite.x;
    const dy = defender.sprite.y - defender.cfg.displayH * 0.6;
    fx.moveTo(ax, ay);
    fx.lineTo(dx, dy);
    fx.strokePath();
    for (let i = 0; i < 3; i++) {
      const sx = dx + Phaser.Math.FloatBetween(-6, 6);
      const sy = dy + Phaser.Math.FloatBetween(-6, 6);
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

  updateEntityVisuals(ent, now) {
    if (ent.isDead) return;
    const cfg = ent.cfg;
    // ===== 血条/名称位置: 放在显示区头顶 =====
    const bx = ent.sprite.x;
    const by = ent.sprite.y - cfg.displayH - 6;
    ent.hpBarBg.setPosition(bx, by);
    ent.hpBar.setPosition(bx - 21, by);
    const pct = Math.max(0, ent.hp / ent.maxHp);
    ent.hpBar.setScale(pct, 1);
    if (pct > 0.6) ent.hpBar.setTexture('hpBarGreen');
    else if (pct > 0.3) ent.hpBar.setTexture('hpBarYellow');
    else ent.hpBar.setTexture('hpBarRed');
    ent.nameTag.setPosition(ent.sprite.x, ent.sprite.y - cfg.displayH - 18);

    // ===== 命中闪烁: 短暂闪白 =====
    if (ent.hitFlash > 0) {
      ent.sprite.setTint(0xffffff);
      ent.hitFlash--;
      if (ent.hitFlash === 0) ent.sprite.clearTint();
    }

    // ===== 朝向: 根据水平速度 flipX (sprite 原图朝右的话 flipX=true 变朝左) =====
    const vx = ent.sprite.body.velocity.x;
    if (vx < -4) ent.sprite.flipX = true;
    else if (vx > 4) ent.sprite.flipX = false;

    // ===== 动画切换: attack/hurt 期间保持, 否则按移动速度切 walk/idle =====
    const inAttack = ent._attackAnimUntil && now < ent._attackAnimUntil;
    const inHurt   = ent._hurtAnimUntil   && now < ent._hurtAnimUntil;
    if (inAttack || inHurt) return;

    const speed = Math.abs(vx);
    if (speed > 18) {
      const walkKey = `${ent.type}:walking`;
      if (this.anims.exists(walkKey) && ent.sprite.anims.currentAnim?.key !== walkKey) {
        ent.sprite.play(walkKey);
      }
    } else {
      const idleKey = `${ent.type}:idle`;
      if (this.anims.exists(idleKey) && ent.sprite.anims.currentAnim?.key !== idleKey) {
        ent.sprite.play(idleKey);
      }
    }
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
// 手机端(窄屏或触摸 coarse)：禁用悬浮球, 始终保留顶部 toolbar, 不切 hide-toolbar 模式
function _isMobileNoFab() {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return w <= 768 || !!coarse;
}

function applyToolbarHiddenMode(hidden) {
  // 手机端用户明确不要悬浮球: 始终显示顶部 toolbar, 任何情况下都不 hide
  if (_isMobileNoFab()) hidden = false;
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

  // -------- 摄像机缩放按钮 (两处 + / -) --------
  function doZoomIn() {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene && scene._zoomIn) scene._zoomIn();
  }
  function doZoomOut() {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (scene && scene._zoomOut) scene._zoomOut();
  }
  document.getElementById('btn-zoomin')?.addEventListener('click', doZoomIn);
  document.getElementById('btn-zoomout')?.addEventListener('click', doZoomOut);
  document.getElementById('fab-btn-zoomin')?.addEventListener('click', doZoomIn);
  document.getElementById('fab-btn-zoomout')?.addEventListener('click', doZoomOut);

  // -------- 虚拟方向键 D-PAD (长按持续平移摄像机) --------
  const dpadDirs = ['up', 'down', 'left', 'right', 'center'];
  function setDPadHeld(dir, held) {
    const scene = gameInstance?.scene.getScene('GameScene');
    if (!scene || !scene._camDPadHeld) return;
    scene._camDPadHeld[dir] = !!held;
    // 视觉高亮
    const btn = document.getElementById('fab-btn-cam-' + dir);
    if (btn) btn.classList.toggle('is-held', !!held);
  }
  function bindDPadButton(dir) {
    const btnId = 'fab-btn-cam-' + dir;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    // pointerdown 按下 (含鼠标/触摸/笔)
    btn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      btn.setPointerCapture?.(ev.pointerId);
      if (dir === 'center') {
        // 中键立即重置视角, 同时也 set held 防止抖动
        doResetView();
        setDPadHeld('center', true);
        setTimeout(() => setDPadHeld('center', false), 220);
      } else {
        setDPadHeld(dir, true);
      }
    });
    // pointerup / pointercancel / leave 都取消
    const cancel = (ev) => {
      if (dir !== 'center') setDPadHeld(dir, false);
    };
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('pointerleave', cancel);
    // 防止 iOS Safari 长按弹出系统菜单
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  dpadDirs.forEach(bindDPadButton);

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
