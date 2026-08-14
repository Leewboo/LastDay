// 内嵌 LLM 后端 (方案 B 的进阶版): 用 node-llama-cpp 直接在 Node 进程内推理
// 无需单独跑 Ollama 或 llama-server, 一个 `node server.js` 全搞定
//
// 触发条件 (任一):
//   1. 环境变量 LLM_GGUF 指向一个 .gguf 模型文件路径
//   2. 默认搜索路径存在 qwen2.5-0.5b gguf 文件 (Ollama blob 或用户下载的)
//
// 用法 (在 server.js 中动态 import):
//   const embedded = await import('./llm-embedded.mjs').catch(()=>null);
//   if (embedded?.isAvailable()) {
//     const r = await embedded.chat({ messages, temperature, maxTokens });
//   }

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ===== 模型路径自动探测 =====
function findGgufModel() {
  // 1) 环境变量显式指定
  if (process.env.LLM_GGUF && fs.existsSync(process.env.LLM_GGUF)) {
    return process.env.LLM_GGUF;
  }
  // 2) 项目目录内 ./models/*.gguf
  const localModelDir = path.join(process.cwd(), 'models');
  if (fs.existsSync(localModelDir)) {
    const gguf = fs.readdirSync(localModelDir).find(f => f.endsWith('.gguf'));
    if (gguf) return path.join(localModelDir, gguf);
  }
  // 3) Ollama 的 blob 目录 (找最大的 .gguf 文件)
  const ollamaModels = path.join(os.homedir(), '.ollama', 'models', 'blobs');
  if (fs.existsSync(ollamaModels)) {
    let best = null, bestSize = 0;
    for (const f of fs.readdirSync(ollamaModels)) {
      const full = path.join(ollamaModels, f);
      const stat = fs.statSync(full);
      // Ollama blob 是 sha256-xxx 文件名, 但内部是 GGUF 格式
      if (stat.size > bestSize && stat.size > 50 * 1024 * 1024) {
        // 验证 magic = "GGUF"
        const fd = fs.openSync(full, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        if (buf.toString() === 'GGUF') {
          best = full; bestSize = stat.size;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

// ===== GGUF 文件完整性检查 (防止下一半就拿上来加载) =====
// 参考 GGUF v3 格式: magic(4) + version(4) + tensor_count(8) + metadata_kv_count(8) + ... + tensor_data_offset(8)
// 最小有效文件: 至少有 header + 1 个 tensor 偏移, 不可能 < 200MB (0.5B q4_k 最小约 200MB)
const MIN_GGUF_SIZE = 150 * 1024 * 1024; // 150MB 兜底

function validateGguf(p) {
  if (!p || !fs.existsSync(p)) return { ok: false, reason: '文件不存在' };
  const stat = fs.statSync(p);
  if (stat.size < MIN_GGUF_SIZE) {
    return { ok: false, reason: `文件太小 (${(stat.size/1024/1024).toFixed(1)}MB < 150MB), 下载未完成或不是完整模型` };
  }
  const fd = fs.openSync(p, 'r');
  try {
    const header = Buffer.alloc(32);
    const n = fs.readSync(fd, header, 0, 32, 0);
    if (n < 8) return { ok: false, reason: 'header 不足 8 字节, 文件损坏' };
    const magic = header.slice(0, 4).toString();
    if (magic !== 'GGUF') return { ok: false, reason: `魔数错误: "${magic}" !== "GGUF", 文件不是 GGUF 格式或下坏了` };
    const version = header.readUInt32LE(4);
    if (version < 2 || version > 5) return { ok: false, reason: `GGUF 版本异常: ${version}` };
    // 校验尾部字节: 读最后 4 字节, 确保文件是完整的 (非中断下载)
    const tail = Buffer.alloc(4);
    fs.readSync(fd, tail, 0, 4, Math.max(0, stat.size - 4));
    // 尾部不全是 0x00 (中断下载的典型表现是 trailing zeros 或被截断)
    let nonZero = 0;
    for (let i = 0; i < 4; i++) if (tail[i] !== 0) nonZero++;
    if (nonZero === 0) {
      return { ok: false, reason: '文件尾部全为 0, 大概率是下载中断。删掉重下 aria2c -x16 -s16 -c ...' };
    }
    return { ok: true, sizeMB: (stat.size / 1024 / 1024).toFixed(1), version };
  } catch (e) {
    return { ok: false, reason: `读文件失败: ${e.message}` };
  } finally {
    fs.closeSync(fd);
  }
}

let MODEL_PATH = findGgufModel();
let _modelValidation = MODEL_PATH ? validateGguf(MODEL_PATH) : null;

if (MODEL_PATH && !_modelValidation.ok) {
  console.error(`\n[llm-embedded] ⚠️  模型文件无效: ${MODEL_PATH}`);
  console.error(`[llm-embedded]    原因: ${_modelValidation.reason}`);
  console.error(`[llm-embedded]    修复: rm ${MODEL_PATH}`);
  console.error(`[llm-embedded]         aria2c -x 16 -s 16 -k 1M -c -o qwen2.5-0.5b.gguf \\`);
  console.error(`[llm-embedded]           "https://hf-mirror.com/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"\n`);
  MODEL_PATH = null;
} else if (MODEL_PATH) {
  console.log(`[llm-embedded] GGUF 校验通过: ${_modelValidation.sizeMB}MB, version ${_modelValidation.version}`);
}

// ===== 单例: 模型只加载一次, session 复用 =====
let _llama = null;
let _model = null;
let _session = null;
let _initPromise = null;
let _available = !!MODEL_PATH;

async function ensureLoaded() {
  if (_session) return _session;
  if (!_initPromise) {
    _initPromise = (async () => {
      console.log(`[llm-embedded] 加载模型: ${MODEL_PATH}`);
      const t0 = Date.now();
      _llama = await getLlama();
      _model = await _llama.loadModel({ modelPath: MODEL_PATH });
      // ===== 手机 (Termux) 适配: 默认调小 context + threads =====
      // 2048 ctx + 3 threads 在 4-6GB 内存手机上很容易 OOM 导致 decode 全是垃圾 tokens
      const defaultCtx = Math.min(parseInt(process.env.LLM_CONTEXT || '1024', 10), 2048);
      // os.cpus() 在手机上可能返回 8 核 (4小+4大), 但只跑 2 线程最稳
      const defaultThreads = Math.min(parseInt(process.env.LLM_THREADS || '2', 10), 4);
      const ctx = await _model.createContext({
        contextSize: defaultCtx,
        threads: defaultThreads,
      });
      const seq = ctx.getSequence();
      // ===== 关键: 不传 chatWrapper, 让 GGUF 文件自带的 chat_template 自动生效 =====
      // Qwen2.5 的 GGUF 里已经内置了 <|im_start|>/<|im_end|> chat template 元数据,
      // 强制塞 ChatMLChatWrapper 反而会与 control token override 冲突,
      // 表现为 decode 出来全是同一个奇怪字符 (你截图里的 @@@... 就是这个症状)
      _session = new LlamaChatSession({
        contextSequence: seq,
        // chatWrapper: undefined → node-llama-cpp 自动从 GGUF 元数据加载
      });
      console.log(`[llm-embedded] 模型就绪 (${((Date.now()-t0)/1000).toFixed(1)}s) ctx=${defaultCtx} threads=${defaultThreads}`);
      return _session;
    })().catch(e => {
      console.error('[llm-embedded] 加载失败:', e.message);
      _available = false;
      _initPromise = null;
      throw e;
    });
  }
  return _initPromise;
}

// ===== 推理 API (与 server.js 的 /api/llm/chat 兼容) =====
// 对字符串做 UTF-8 保真清洗: 如果 node-llama-cpp 内部 decode 出了垃圾字节,
// 这里兜底把无效 UTF-8 替换字符和孤立代理项清掉, 避免传给前端一团 @
function _sanitizeDecodedText(s) {
  if (!s || typeof s !== 'string') return '';
  // 1) 通过 Buffer 绕一圈: 字符串 → UTF-8 字节 → 重新 UTF-8 decode (fatal=false 会把坏字节清掉)
  //    能处理 node-llama-cpp 内部因为 OOM / 表错乱 decode 出的"伪字符串里混着坏字节"
  try {
    const buf = Buffer.from(s, 'utf8');
    s = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch (_) {}
  // 2) 去掉替换字符、孤立代理项、控制字符
  s = s
    .replace(/\uFFFD/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  // 3) 垃圾检测: 如果是同一个字符重复 10+ 次 (典型 OOM decode 垃圾), 直接丢弃
  if (s.length >= 20) {
    const first = s[0];
    let same = true;
    for (const ch of s) { if (ch !== first) { same = false; break; } }
    if (same) return '';
  }
  // 4) 如果可打印字符占比太低 (<60%), 也丢弃
  let printable = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (!cp) continue;
    // 普通可打印 ASCII + CJK 汉字/标点 + 常见符号
    if ((cp >= 0x20 && cp <= 0x7e) ||
        (cp >= 0x3000 && cp <= 0x303f) ||
        (cp >= 0x4e00 && cp <= 0x9fff) ||
        (cp >= 0xff00 && cp <= 0xffef) ||
        cp === 0xa || cp === 0xd || cp === 0x9) {
      printable++;
    }
  }
  if (s.length > 0 && printable / s.length < 0.6) return '';
  return s;
}

export async function chat({ messages, temperature = 0.9, maxTokens = 40 }) {
  if (!_available) throw new Error('embedded LLM not available');
  const session = await ensureLoaded();

  // 从 messages 提取 system + user 内容
  const sysMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role === 'user');
  const userText = userMsgs.map(m => m.content).join('\n');

  // ===== 手机内存适配: 回退到单例 session, 每次调用前清 history =====
  // 不新建 context 避免反复分配 KV cache → OOM → decode 成 @@@@
  if (session && typeof session.reset === 'function') {
    try { await session.reset(); } catch (_) {}
  }
  if (session && Array.isArray(session.history)) {
    session.history = [];
  } else if (session && session.sequence && typeof session.sequence.clear === 'function') {
    try { session.sequence.clear(); } catch (_) {}
  }

  const resp = await session.prompt(userText, {
    systemPrompt: sysMsg ? sysMsg.content : '',
    maxTokens: Math.min(maxTokens, 48),
    temperature,
  });

  // 后端先做一层清洗: 如果模型/内存层面已经 decode 成垃圾, 这里就拦掉, 不污染前端
  const clean = _sanitizeDecodedText(resp);
  return clean;
}

export function isAvailable() { return _available; }
export function getModelPath() { return MODEL_PATH; }

// 预热 (server.js 启动时后台调用, 不阻塞)
export async function warmup() {
  if (!_available) return false;
  try {
    await ensureLoaded();
    return true;
  } catch (e) {
    return false;
  }
}
