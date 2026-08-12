// ============================================================
//  🧟 丧尸沙盒游戏 - Zombie Sandbox Game
//  引擎: Phaser 3.80
// ============================================================

// ---------- 角色配置常量 ----------
const PALETTE = {
  green: 0x22c55e,
  greenDark: 0x15803d,
  greenDarker: 0x0f5c2b,
  red: 0xef4444,
  redDark: 0x991b1b,
  redDarker: 0x6b0f10,
  skin: 0xe5c5a5,
  skinZ: 0x8a7a6a,
  black: 0x0a0a0a,
  black2: 0x141414,
  line: 0x1f1f1f,
  line2: 0x2a2a2a,
  text: 0xe0e0e0,
  muted: 0x666666,
  white: 0xffffff
};

const ENTITY_CONFIG = {
  survivor_male: {
    name: 'MALE',
    category: 'survivor',
    hp: 100, maxHp: 100,
    speed: 80,
    damage: 15,
    attackRange: 32,
    attackCooldown: 800,
    detectRange: 220,
    fleeRange: 80,
    aggression: 0.35,
    color: PALETTE.green,
    accentColor: PALETTE.greenDark,
    skinColor: PALETTE.skin,
    size: 14
  },
  survivor_female: {
    name: 'FEMALE',
    category: 'survivor',
    hp: 85, maxHp: 85,
    speed: 92,
    damage: 11,
    attackRange: 30,
    attackCooldown: 700,
    detectRange: 260,
    fleeRange: 100,
    aggression: 0.2,
    color: PALETTE.green,
    accentColor: PALETTE.greenDarker,
    skinColor: PALETTE.skin,
    size: 13
  },
  zombie_normal: {
    name: 'NORMAL',
    category: 'zombie',
    hp: 100, maxHp: 100,
    speed: 45,
    damage: 12,
    attackRange: 28,
    attackCooldown: 1000,
    detectRange: 280,
    color: PALETTE.red,
    accentColor: PALETTE.redDark,
    skinColor: PALETTE.skinZ,
    size: 14
  },
  zombie_fast: {
    name: 'FAST',
    category: 'zombie',
    hp: 55, maxHp: 55,
    speed: 115,
    damage: 7,
    attackRange: 26,
    attackCooldown: 550,
    detectRange: 320,
    color: PALETTE.red,
    accentColor: PALETTE.redDark,
    skinColor: PALETTE.skinZ,
    size: 12
  },
  zombie_tank: {
    name: 'TANK',
    category: 'zombie',
    hp: 320, maxHp: 320,
    speed: 28,
    damage: 30,
    attackRange: 34,
    attackCooldown: 1400,
    detectRange: 250,
    color: PALETTE.red,
    accentColor: PALETTE.redDarker,
    skinColor: PALETTE.skinZ,
    size: 19
  }
};

// ---------- 全局状态 ----------
let gameInstance = null;
let selectedTool = null;
let gameSpeed = 1;
let paused = false;

// ============================================================
//  Phaser 启动
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundColor: '#233142',
    pixelArt: false,
    scene: [BootScene, GameScene],
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };
  gameInstance = new Phaser.Game(config);
  setupToolbar();
  window.addEventListener('resize', () => {
    if (gameInstance) {
      gameInstance.scale.resize(container.clientWidth, container.clientHeight);
    }
  });
});

// ============================================================
//  场景 1: 生成程序化纹理
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // 尝试检测用户自定义素材
    this.load.json('assetCheck', '/api/assets');
  }

  create() {
    const assetData = this.cache.json.get('assetCheck') || { customAssetsAvailable: false };

    // 为每种角色生成程序化纹理
    Object.keys(ENTITY_CONFIG).forEach(type => {
      const cfg = ENTITY_CONFIG[type];
      this.generateCharacterTexture(type, cfg, assetData.customAssetsAvailable);
    });

    // 生成血条纹理
    this.generateHpBarTextures();
    // 生成地板纹理
    this.generateFloorTexture();

    this.scene.start('GameScene');
  }

  // ---- 极简程序化角色纹理 ----
  generateCharacterTexture(type, cfg) {
    const size = cfg.size * 3;
    const w = size * 2;
    const h = size * 2.4;
    const g = this.add.graphics();
    const isSurvivor = cfg.category === 'survivor';
    const primColor = isSurvivor ? PALETTE.green : PALETTE.red;
    const darkColor = isSurvivor ? PALETTE.greenDark : PALETTE.redDark;

    // 阴影 - 纯黑方块
    g.fillStyle(PALETTE.black, 0.5);
    g.fillRect(w / 2 - size * 0.7, h - size * 0.25, size * 1.4, size * 0.18);

    // 身体 - 极简矩形
    g.fillStyle(primColor, 1);
    g.fillRect(w / 2 - size * 0.55, h / 2, size * 1.1, size * 1.05);
    // 身体描边
    g.lineStyle(2, PALETTE.black, 1);
    g.strokeRect(w / 2 - size * 0.55, h / 2, size * 1.1, size * 1.05);
    // 身体下半深色块
    g.fillStyle(darkColor, 1);
    g.fillRect(w / 2 - size * 0.55, h / 2 + size * 0.65, size * 1.1, size * 0.4);
    g.lineStyle(2, PALETTE.black, 1);
    g.strokeRect(w / 2 - size * 0.55, h / 2 + size * 0.65, size * 1.1, size * 0.4);

    // 头部 - 极简方块+描边
    g.fillStyle(cfg.skinColor, 1);
    g.fillRect(w / 2 - size * 0.5, h / 2 - size * 0.95, size, size * 0.95);
    g.lineStyle(2, PALETTE.black, 1);
    g.strokeRect(w / 2 - size * 0.5, h / 2 - size * 0.95, size, size * 0.95);

    // 角色类型特征条带
    if (type === 'survivor_male') {
      // 顶部水平条（帽子）
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - size * 0.5, h / 2 - size * 0.95, size, size * 0.25);
    } else if (type === 'survivor_female') {
      // 侧边长条（马尾）
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 + size * 0.35, h / 2 - size * 0.85, size * 0.22, size * 1.1);
    } else if (type === 'zombie_fast') {
      // 两条斜线（速度纹）
      g.lineStyle(3, PALETTE.black, 1);
      g.beginPath();
      g.moveTo(w / 2 - size * 0.5, h / 2 + size * 0.3);
      g.lineTo(w / 2 + size * 0.1, h / 2 + size * 0.15);
      g.moveTo(w / 2 - size * 0.1, h / 2 + size * 0.85);
      g.lineTo(w / 2 + size * 0.5, h / 2 + size * 0.6);
      g.strokePath();
    } else if (type === 'zombie_tank') {
      // 十字加强纹
      g.lineStyle(4, PALETTE.black, 1);
      g.beginPath();
      g.moveTo(w / 2, h / 2 + size * 0.05);
      g.lineTo(w / 2, h / 2 + size * 1.0);
      g.moveTo(w / 2 - size * 0.55, h / 2 + size * 0.5);
      g.lineTo(w / 2 + size * 0.55, h / 2 + size * 0.5);
      g.strokePath();
    }

    // 面部 - 极简线/像素块
    if (cfg.category === 'zombie') {
      // 丧尸: 红色方块眼睛
      g.fillStyle(PALETTE.red, 1);
      g.fillRect(w / 2 - size * 0.35, h / 2 - size * 0.7, size * 0.18, size * 0.18);
      g.fillRect(w / 2 + size * 0.17, h / 2 - size * 0.7, size * 0.18, size * 0.18);
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - size * 0.28, h / 2 - size * 0.63, size * 0.05, size * 0.05);
      g.fillRect(w / 2 + size * 0.24, h / 2 - size * 0.63, size * 0.05, size * 0.05);
      // 嘴: 黑锯齿条
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - size * 0.3, h / 2 - size * 0.3, size * 0.6, size * 0.12);
    } else {
      // 幸存者: 黑色小方块眼睛
      g.fillStyle(PALETTE.black, 1);
      g.fillRect(w / 2 - size * 0.32, h / 2 - size * 0.68, size * 0.12, size * 0.12);
      g.fillRect(w / 2 + size * 0.2, h / 2 - size * 0.68, size * 0.12, size * 0.12);
      // 嘴: 细横线
      g.lineStyle(1.5, PALETTE.black, 1);
      g.beginPath();
      g.moveTo(w / 2 - size * 0.2, h / 2 - size * 0.3);
      g.lineTo(w / 2 + size * 0.2, h / 2 - size * 0.3);
      g.strokePath();
    }

    g.generateTexture(type, w, h);
    g.destroy();
  }

  generateHpBarTextures() {
    const W = 40, H = 5;
    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.black2, 1);
    bg.fillRect(0, 0, W, H);
    bg.lineStyle(1, PALETTE.line2, 1);
    bg.strokeRect(0, 0, W, H);
    bg.generateTexture('hpBarBg', W, H);
    bg.destroy();
    // 绿
    const g = this.add.graphics();
    g.fillStyle(PALETTE.green, 1);
    g.fillRect(1, 1, W - 2, H - 2);
    g.generateTexture('hpBarGreen', W, H);
    g.destroy();
    // 黄 (极简里保留但用橙红色调)
    const y = this.add.graphics();
    y.fillStyle(PALETTE.red, 0.65);
    y.fillRect(1, 1, W - 2, H - 2);
    y.generateTexture('hpBarYellow', W, H);
    y.destroy();
    // 红
    const r = this.add.graphics();
    r.fillStyle(PALETTE.red, 1);
    r.fillRect(1, 1, W - 2, H - 2);
    r.generateTexture('hpBarRed', W, H);
    r.destroy();
  }

  generateFloorTexture() {
    const size = 64;
    const g = this.add.graphics();
    g.fillStyle(PALETTE.black, 1);
    g.fillRect(0, 0, size, size);
    // 极简网格线
    g.lineStyle(1, PALETTE.line, 1);
    g.strokeRect(0, 0, size, size);
    g.beginPath();
    g.moveTo(size / 2, 0); g.lineTo(size / 2, size);
    g.moveTo(0, size / 2); g.lineTo(size, size / 2);
    g.strokePath();
    g.generateTexture('floorTile', size, size);
    g.destroy();
  }
}

// ============================================================
//  场景 2: 主游戏场景
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.entities = [];       // 存活角色
    this.corpses = [];        // 尸体
    this.fightEffects = [];   // 战斗特效
    this.lastTime = 0;
    this.stats = { survivors: 0, zombies: 0, dead: 0, fights: 0 };

    this.buildMap();
    this.buildInputHandlers();

    // 状态栏更新定时
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => this.updateStatusBar()
    });
  }

  // ---- 地图构建 ----
  buildMap() {
    const { width, height } = this.scale;
    // 地板
    const tile = this.textures.get('floorTile').getSourceImage();
    const tw = tile.width, th = tile.height;
    for (let x = 0; x < width + tw; x += tw) {
      for (let y = 0; y < height + th; y += th) {
        this.add.image(x, y, 'floorTile').setOrigin(0, 0).setAlpha(0.9);
      }
    }
    // 边界墙
    const walls = this.physics.add.staticGroup();
    const t = 20;
    walls.create(0, height / 2, null).setSize(t, height * 2).setVisible(false).refreshBody();
    walls.create(width, height / 2, null).setSize(t, height * 2).setVisible(false).refreshBody();
    walls.create(width / 2, 0, null).setSize(width * 2, t).setVisible(false).refreshBody();
    walls.create(width / 2, height, null).setSize(width * 2, t).setVisible(false).refreshBody();
    this.walls = walls;

    // 地图边界装饰墙 - 极简
    const wallGfx = this.add.graphics();
    wallGfx.fillStyle(PALETTE.black2, 1);
    wallGfx.fillRect(0, 0, width, 6);
    wallGfx.fillRect(0, height - 6, width, 6);
    wallGfx.fillRect(0, 0, 6, height);
    wallGfx.fillRect(width - 6, 0, 6, height);
    // 内部单线边框 (红)
    wallGfx.lineStyle(1, PALETTE.red, 0.5);
    wallGfx.strokeRect(16, 16, width - 32, height - 32);

    // 装饰障碍 (掩体) - 极简矩形
    this.obstacles = this.physics.add.staticGroup();
    const obstaclePositions = [
      { x: width * 0.2, y: height * 0.3, w: 80, h: 40 },
      { x: width * 0.75, y: height * 0.25, w: 60, h: 60 },
      { x: width * 0.3, y: height * 0.7, w: 100, h: 30 },
      { x: width * 0.8, y: height * 0.75, w: 50, h: 90 },
      { x: width * 0.55, y: height * 0.5, w: 70, h: 50 }
    ];
    obstaclePositions.forEach(o => {
      this.obstacles.create(o.x, o.y, null).setSize(o.w, o.h).setVisible(false).refreshBody();
      const og = this.add.graphics();
      og.fillStyle(PALETTE.black2, 1);
      og.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
      og.lineStyle(1, PALETTE.line2, 1);
      og.strokeRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    });
  }

  // ---- 输入处理 ----
  buildInputHandlers() {
    this.input.on('pointerdown', (pointer) => {
      // 忽略UI上方的点击
      if (pointer.y <= 60) return;
      if (!selectedTool) return;
      this.spawnEntity(selectedTool, pointer.x, pointer.y);
    });

    // 鼠标悬停预览 - 极简
    this.input.on('pointermove', (pointer) => {
      if (!this.placementPreview) {
        this.placementPreview = this.add.image(pointer.x, pointer.y, selectedTool || 'survivor_male');
        this.placementPreview.setAlpha(0.5).setDepth(999);
        this.placementPreviewLine = this.add.circle(pointer.x, pointer.y, 0, 0, 0);
        this.placementPreviewLine.setStrokeStyle(1, PALETTE.text, 0.15);
        this.placementPreviewLine.setDepth(998);
        this.placementPreviewLine.setFillStyle(0, 0);
      }
      if (selectedTool) {
        this.placementPreview.setVisible(true);
        this.placementPreview.setPosition(pointer.x, pointer.y);
        this.placementPreview.setTexture(selectedTool);
        const cfg = ENTITY_CONFIG[selectedTool];
        this.placementPreviewLine.setVisible(true);
        this.placementPreviewLine.setPosition(pointer.x, pointer.y);
        this.placementPreviewLine.setRadius(cfg.detectRange);
        this.placementPreviewLine.setStrokeStyle(1, cfg.color, 0.5);
      } else {
        this.placementPreview.setVisible(false);
        this.placementPreviewLine.setVisible(false);
      }
    });
  }

  // ---- 生成角色 ----
  spawnEntity(type, x, y) {
    const cfg = ENTITY_CONFIG[type];
    const ent = {};

    // 精灵
    ent.sprite = this.physics.add.sprite(x, y, type);
    ent.sprite.setCollideWorldBounds(true);
    ent.sprite.setBounce(0.15);
    ent.sprite.setDepth(10);
    ent.sprite.body.setCircle(cfg.size * 0.6, cfg.size * 0.2, cfg.size * 0.6);

    // 属性
    ent.type = type;
    ent.cfg = cfg;
    ent.hp = cfg.hp;
    ent.maxHp = cfg.maxHp;
    ent.isDead = false;
    ent.lastAttack = 0;
    ent.target = null;
    ent.aggroTimer = 0;
    ent.wanderDir = new Phaser.Math.Vector2(
      Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)
    ).normalize();
    ent.wanderTimer = 0;
    ent.hitFlash = 0;

    // 血条
    ent.hpBarBg = this.add.image(x, y - cfg.size * 1.7, 'hpBarBg').setDepth(20);
    ent.hpBar = this.add.image(x, y - cfg.size * 1.7, 'hpBarGreen').setDepth(21);
    ent.hpBar.setOrigin(0.05, 0.5);
    ent.hpBarBg.setOrigin(0.5, 0.5);

    // 名字标签 - 极简等宽字体
    ent.nameTag = this.add.text(x, y - cfg.size * 2.3, cfg.name, {
      fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
      fontSize: '9px',
      color: cfg.category === 'survivor' ? '#22c55e' : '#ef4444',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(22).setAlpha(0.85);

    // 物理碰撞
    this.physics.add.collider(ent.sprite, this.walls);
    this.physics.add.collider(ent.sprite, this.obstacles);

    // 与其他实体的碰撞 (避免重叠穿透)
    this.entities.forEach(other => {
      this.physics.add.collider(ent.sprite, other.sprite, null, null, this);
    });

    this.entities.push(ent);
    this.updateStats(true);
  }

  // ---- 统计 ----
  updateStats(silent = false) {
    const counts = { survivor: 0, zombie: 0 };
    this.entities.forEach(e => { if (!e.isDead) counts[e.cfg.category]++; });
    this.stats.survivors = counts.survivor;
    this.stats.zombies = counts.zombie;
    this.stats.dead = this.corpses.length;
  }

  updateStatusBar() {
    document.getElementById('count-survivors').textContent = this.stats.survivors;
    document.getElementById('count-zombies').textContent = this.stats.zombies;
    document.getElementById('count-dead').textContent = this.stats.dead;
    document.getElementById('count-fights').textContent = this.stats.fights;
  }

  // ---- 核心更新循环 ----
  update(time, delta) {
    if (paused) return;
    const dt = (delta / 16.666) * gameSpeed; // 归一化到 60fps，再乘速度倍率
    const now = time * gameSpeed + (this._timeOffset || 0);
    this._timeOffset = (this._timeOffset || 0) + delta * (gameSpeed - 1);

    this.entities.forEach(ent => {
      if (ent.isDead) return;
      this.updateEntityAI(ent, now, dt, time);
      this.updateEntityVisuals(ent);
    });

    // 战斗特效更新
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

  // ---- 角色 AI ----
  updateEntityAI(ent, now, dt, realTime) {
    const cfg = ent.cfg;
    let nearestEnemy = null;
    let nearestDist = Infinity;

    // 查找最近敌人
    this.entities.forEach(other => {
      if (other === ent || other.isDead) return;
      if (other.cfg.category === cfg.category) return; // 同类不互攻
      const d = Phaser.Math.Distance.Between(ent.sprite.x, ent.sprite.y, other.sprite.x, other.sprite.y);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = other; }
    });

    ent.target = (nearestEnemy && nearestDist <= cfg.detectRange) ? nearestEnemy : null;
    const hasTarget = !!ent.target;

    // ---- 移动向量 ----
    let moveX = 0, moveY = 0;
    let speedMult = 1;

    if (cfg.category === 'survivor') {
      // 幸存者 AI
      if (hasTarget) {
        const dist = nearestDist;
        const zombie = ent.target;
        // 距离判断：近则战斗 / 中距离反击 / 远则逃跑
        if (dist < cfg.attackRange + 6) {
          // 近距离 -> 战斗
          this.tryAttack(ent, zombie, now, realTime);
          // 轻微后撤
          const dx = ent.sprite.x - zombie.sprite.x;
          const dy = ent.sprite.y - zombie.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          moveX = (dx / len) * 0.3;
          moveY = (dy / len) * 0.3;
        } else if (dist < cfg.fleeRange && Math.random() > cfg.aggression) {
          // 中距离且不够勇敢 -> 逃跑
          const dx = ent.sprite.x - zombie.sprite.x;
          const dy = ent.sprite.y - zombie.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          moveX = dx / len;
          moveY = dy / len;
          speedMult = 1.1; // 逃跑加速
        } else if (dist < cfg.detectRange && Math.random() < cfg.aggression + 0.1) {
          // 有勇气 -> 靠近反击
          const dx = zombie.sprite.x - ent.sprite.x;
          const dy = zombie.sprite.y - ent.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          moveX = dx / len;
          moveY = dy / len;
        } else {
          // 保持距离
          const dx = ent.sprite.x - zombie.sprite.x;
          const dy = ent.sprite.y - zombie.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          const ideal = (cfg.fleeRange + cfg.detectRange) / 2;
          const diff = dist - ideal;
          moveX = (dx / len) * Math.sign(diff) * 0.5;
          moveY = (dy / len) * Math.sign(diff) * 0.5;
        }
      } else {
        // 无敌人 -> 闲逛
        moveX = ent.wanderDir.x;
        moveY = ent.wanderDir.y;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          ent.wanderDir.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)).normalize();
          ent.wanderTimer = 60 + Math.random() * 180;
        }
      }
    } else {
      // 丧尸 AI
      if (hasTarget) {
        const dist = nearestDist;
        const target = ent.target;
        if (dist < cfg.attackRange + 4) {
          // 攻击
          this.tryAttack(ent, target, now, realTime);
          // 小幅前进
          const dx = target.sprite.x - ent.sprite.x;
          const dy = target.sprite.y - ent.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          moveX = (dx / len) * 0.4;
          moveY = (dy / len) * 0.4;
        } else {
          // 追击
          const dx = target.sprite.x - ent.sprite.x;
          const dy = target.sprite.y - ent.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          moveX = dx / len;
          moveY = dy / len;
        }
        ent.aggroTimer = 3000; // 脱战保留仇恨
      } else if (ent.aggroTimer > 0) {
        // 失去目标的短暂搜索
        moveX = ent.wanderDir.x;
        moveY = ent.wanderDir.y;
        ent.aggroTimer -= dt * 16;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          ent.wanderDir.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)).normalize();
          ent.wanderTimer = 30 + Math.random() * 60;
        }
      } else {
        // 闲逛 (丧尸慢)
        moveX = ent.wanderDir.x * 0.4;
        moveY = ent.wanderDir.y * 0.4;
        ent.wanderTimer -= dt;
        if (ent.wanderTimer <= 0) {
          ent.wanderDir.set(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)).normalize();
          ent.wanderTimer = 120 + Math.random() * 300;
        }
      }
    }

    // 应用速度
    const mag = Math.hypot(moveX, moveY) || 1;
    const speed = cfg.speed * speedMult;
    ent.sprite.setVelocity((moveX / mag) * speed * dt, (moveY / mag) * speed * dt);

    // 面向方向
    if (mag > 0.1) {
      ent.sprite.setFlipX(moveX < 0);
    }

    // 受击闪烁消退 - 极简红闪
    if (ent.hitFlash > 0) {
      ent.hitFlash -= dt;
      const flashOn = Math.floor(ent.hitFlash / 3) % 2 === 0;
      ent.sprite.setTint(flashOn ? PALETTE.red : PALETTE.white);
      if (ent.hitFlash <= 0) ent.sprite.clearTint();
    }
  }

  // ---- 攻击 ----
  tryAttack(attacker, defender, now, realTime) {
    if (now - attacker.lastAttack < attacker.cfg.attackCooldown) return;
    attacker.lastAttack = now;

    // 伤害判定
    const variance = 0.85 + Math.random() * 0.3;
    const dmg = Math.round(attacker.cfg.damage * variance);
    this.dealDamage(defender, dmg, attacker, realTime);

    // 攻击特效
    this.showAttackEffect(attacker, defender);
    this.stats.fights++;
  }

  dealDamage(entity, dmg, attacker, realTime) {
    entity.hp -= dmg;
    entity.hitFlash = 18;
    this.showDamageNumber(entity.sprite.x, entity.sprite.y - entity.cfg.size * 1.8, dmg, attacker.cfg.category === 'zombie');
    if (entity.hp <= 0) {
      this.killEntity(entity, attacker);
    }
  }

  killEntity(entity, killer) {
    entity.isDead = true;
    entity.sprite.setVelocity(0, 0);
    entity.sprite.setTint(PALETTE.muted);
    entity.sprite.setAngle(90);
    entity.sprite.setDepth(5);
    entity.sprite.body.enable = false;
    entity.hpBar.destroy();
    entity.hpBarBg.destroy();
    entity.nameTag.destroy();

    // 尸体阴影 - 极简矩形
    const corpseGfx = this.add.graphics();
    corpseGfx.fillStyle(PALETTE.black, 0.5);
    corpseGfx.fillRect(-entity.cfg.size, -entity.cfg.size * 0.3, entity.cfg.size * 2, entity.cfg.size * 0.6);
    corpseGfx.setPosition(entity.sprite.x, entity.sprite.y + entity.cfg.size * 0.5);
    corpseGfx.setDepth(4);
    this.corpses.push({ sprite: entity.sprite, gfx: corpseGfx });
    entity._corpseGfx = corpseGfx;

    // 从活动列表移除 (保留在场景中显示尸体)
    const idx = this.entities.indexOf(entity);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  showAttackEffect(attacker, defender) {
    // 攻击连线 - 极简单色线
    const fx = this.add.graphics();
    fx.lineStyle(1, attacker.cfg.color, 1);
    fx.beginPath();
    fx.moveTo(attacker.sprite.x, attacker.sprite.y - attacker.cfg.size * 0.3);
    fx.lineTo(defender.sprite.x, defender.sprite.y - defender.cfg.size * 0.4);
    fx.strokePath();
    // 极简火花 (小方块)
    const sparkCount = 3;
    for (let i = 0; i < sparkCount; i++) {
      const sx = defender.sprite.x + Phaser.Math.FloatBetween(-6, 6);
      const sy = defender.sprite.y - defender.cfg.size * 0.4 + Phaser.Math.FloatBetween(-6, 6);
      fx.fillStyle(attacker.cfg.color, 1);
      fx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    this.fightEffects.push({ sprite: fx, life: 180, maxLife: 180 });
  }

  showDamageNumber(x, y, dmg, isZombieAttack) {
    const color = isZombieAttack ? '#ef4444' : '#22c55e';
    const txt = this.add.text(x + Phaser.Math.FloatBetween(-6, 6), y, `-${dmg}`, {
      fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
      fontSize: 'bold 12px',
      color: color,
      letterSpacing: 0
    }).setOrigin(0.5).setDepth(30);
    this.fightEffects.push({ sprite: txt, life: 650, maxLife: 650 });
  }

  // ---- 视觉位置同步 ----
  updateEntityVisuals(ent) {
    if (ent.isDead) return;
    const size = ent.cfg.size;
    const bx = ent.sprite.x;
    const by = ent.sprite.y - size * 1.55;
    ent.hpBarBg.setPosition(bx, by);
    ent.hpBar.setPosition(bx - 19, by);
    const pct = Math.max(0, ent.hp / ent.maxHp);
    ent.hpBar.setScale(pct, 1);
    // 血条颜色
    if (pct > 0.6) ent.hpBar.setTexture('hpBarGreen');
    else if (pct > 0.3) ent.hpBar.setTexture('hpBarYellow');
    else ent.hpBar.setTexture('hpBarRed');

    ent.nameTag.setPosition(ent.sprite.x, ent.sprite.y - size * 2.3);
  }

  // ---- 公共 API ----
  clearAll() {
    this.entities.forEach(e => {
      e.sprite.destroy();
      e.hpBar?.destroy();
      e.hpBarBg?.destroy();
      e.nameTag?.destroy();
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
      e.hpBar?.destroy();
      e.hpBarBg?.destroy();
      e.nameTag?.destroy();
      const idx = this.entities.indexOf(e);
      if (idx >= 0) this.entities.splice(idx, 1);
    });
  }
}

// ============================================================
//  工具栏 UI 逻辑
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

  document.getElementById('btn-pause').addEventListener('click', (e) => {
    paused = !paused;
    e.target.textContent = paused ? '▶ 继续' : '⏸ 暂停';
  });

  const speedBtn = document.getElementById('btn-speed');
  const speeds = [1, 2, 3, 0.5];
  let speedIdx = 0;
  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % speeds.length;
    gameSpeed = speeds[speedIdx];
    speedBtn.textContent = `⏩ ${gameSpeed}x 速度`;
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    const scene = gameInstance.scene.getScene('GameScene');
    if (scene) scene.clearAll();
  });

  document.getElementById('btn-clear-zombies').addEventListener('click', () => {
    const scene = gameInstance.scene.getScene('GameScene');
    if (scene) scene.clearZombies();
  });

  // 数字快捷键
  window.addEventListener('keydown', (e) => {
    const keyMap = { '1': 'survivor_male', '2': 'survivor_female', '3': 'zombie_normal', '4': 'zombie_fast', '5': 'zombie_tank' };
    if (keyMap[e.key]) {
      const btn = document.querySelector(`.tool-btn[data-type="${keyMap[e.key]}"]`);
      if (btn) btn.click();
    } else if (e.key === ' ') {
      e.preventDefault();
      document.getElementById('btn-pause').click();
    } else if (e.key === 'Escape') {
      selectedTool = null;
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    }
  });
}
