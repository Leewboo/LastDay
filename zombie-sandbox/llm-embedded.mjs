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

import { getLlama, LlamaChatSession, ChatMLChatWrapper } from 'node-llama-cpp';
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

const MODEL_PATH = findGgufModel();

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
      // 每次会话复用, systemPrompt 在 chat() 时传
      const ctx = await _model.createContext({
        contextSize: parseInt(process.env.LLM_CONTEXT || '2048', 10),
        threads: parseInt(process.env.LLM_THREADS || '3', 10),
      });
      const seq = ctx.getSequence();
      _session = new LlamaChatSession({
        contextSequence: seq,
        chatWrapper: new ChatMLChatWrapper(),
      });
      console.log(`[llm-embedded] 模型就绪 (${((Date.now()-t0)/1000).toFixed(1)}s)`);
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
export async function chat({ messages, temperature = 0.9, maxTokens = 40 }) {
  if (!_available) throw new Error('embedded LLM not available');
  const session = await ensureLoaded();

  // 从 messages 提取 system + user 内容
  const sysMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role === 'user');
  const userText = userMsgs.map(m => m.content).join('\n');

  // 复用 session 时, 上一轮的对话还在历史里 - 为了让每次 bark 独立, 调用前清空历史
  if (session.history && session.history.length > 0) {
    session.history = [];
  }

  const resp = await session.prompt(userText, {
    systemPrompt: sysMsg ? sysMsg.content : '',
    maxTokens,
    temperature,
  });
  return resp;
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
