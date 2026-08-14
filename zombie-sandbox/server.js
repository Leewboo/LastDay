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

// ====== LLM 代理路由 (方案B: 本地 0.5B 小模型, 通过 Ollama 或 llama-server) ======
// 前端通过 /api/llm/chat 发送请求, server 代理到本地 Ollama(:11434) 或 llama-server(:8080)
// 带超时保护: 如果本地模型不可用或超时, 返回 { ok:false } 让前端 fallback 到模板

const http = require('http');

// 可配置的本地 LLM 后端列表 (按优先级尝试)
const LLM_BACKENDS = [
  { name: 'ollama',       host: '127.0.0.1', port: 11434, path: '/api/chat',    type: 'ollama' },
  { name: 'llama-server', host: '127.0.0.1', port: 8080,  path: '/v1/chat/completions', type: 'openai' },
];

// 缓存: 哪个后端可用 (避免每次都探测)
let _activeBackend = null;
let _backendCheckTime = 0;
const BACKEND_CHECK_INTERVAL = 30000; // 30秒重新探测一次

// 探测本地 LLM 后端是否可用 (非阻塞, 超时 2 秒)
function probeBackend(backend) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: backend.host, port: backend.port,
      path: backend.type === 'ollama' ? '/api/tags' : '/v1/models',
      timeout: 2000,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data.length > 0));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function getActiveBackend() {
  const now = Date.now();
  if (_activeBackend && now - _backendCheckTime < BACKEND_CHECK_INTERVAL) return _activeBackend;
  for (const b of LLM_BACKENDS) {
    const ok = await probeBackend(b);
    if (ok) { _activeBackend = b; _backendCheckTime = now; return b; }
  }
  _activeBackend = null;
  _backendCheckTime = now;
  return null;
}

// POST /api/llm/chat  body: { messages: [...], model?: 'qwen2.5:0.5b', temperature?: 0.8, maxTokens?: 60 }
app.post('/api/llm/chat', async (req, res) => {
  const { messages, model, temperature, maxTokens } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.json({ ok: false, error: 'messages required' });
  }

  const backend = await getActiveBackend();
  if (!backend) {
    return res.json({ ok: false, error: 'no_local_llm', fallback: true });
  }

  // 构建请求体 (Ollama vs OpenAI 格式)
  let payload;
  if (backend.type === 'ollama') {
    payload = JSON.stringify({
      model: model || 'qwen2.5:0.5b',
      messages,
      stream: false,
      options: { temperature: temperature ?? 0.8, num_predict: maxTokens ?? 60 },
      format: 'json',  // 强制 JSON 输出
    });
  } else {
    payload = JSON.stringify({
      model: model || 'qwen2.5:0.5b',
      messages,
      temperature: temperature ?? 0.8,
      max_tokens: maxTokens ?? 60,
      response_format: { type: 'json_object' },
    });
  }

  const postData = (method, pathStr, body) => new Promise((resolve) => {
    const req2 = http.request({
      hostname: backend.host, port: backend.port,
      path: pathStr, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 8000, // 8秒超时 (0.5B 应该 200~500ms 出结果)
    }, (resp) => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => resolve({ status: resp.statusCode, body: d }));
    });
    req2.on('error', (e) => resolve({ status: 0, error: e.message }));
    req2.on('timeout', () => { req2.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req2.write(body);
    req2.end();
  });

  try {
    const result = await postData('POST', backend.path, payload);
    if (result.status !== 200 || !result.body) {
      return res.json({ ok: false, error: `llm_status_${result.status}`, fallback: true });
    }
    const parsed = JSON.parse(result.body);
    // 提取文本 (Ollama: parsed.message.content; OpenAI: parsed.choices[0].message.content)
    const content = backend.type === 'ollama'
      ? (parsed.message?.content || '')
      : (parsed.choices?.[0]?.message?.content || '');
    res.json({ ok: true, content, backend: backend.name });
  } catch (e) {
    res.json({ ok: false, error: e.message, fallback: true });
  }
});

// GET /api/llm/status — 前端轮询 LLM 后端是否可用
app.get('/api/llm/status', async (req, res) => {
  const backend = await getActiveBackend();
  res.json({
    available: !!backend,
    backend: backend ? backend.name : null,
    models: backend ? ['qwen2.5:0.5b', 'qwen2.5:1.5b', 'tinyllama:1.1b'] : [],
  });
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
