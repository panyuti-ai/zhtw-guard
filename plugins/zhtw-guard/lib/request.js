'use strict';

// Remembers, per session, whether the user's latest prompt explicitly asked
// for Simplified Chinese, so the Stop hook does not "fix" what was requested.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SIMPLIFIED = '(?:簡體|简体|簡中|简中|簡化字|简化字|简体中文|簡體中文)';
// A request: a verb or particle right before the script name,
// e.g. 用簡體回答、翻成简体、改成簡體中文、以简体输出.
const ASK = new RegExp(
  `(?:用|以|寫成|写成|改成|改為|改为|翻成|翻譯成|翻译成|轉成|转成|換成|换成|輸出|输出|回答|回覆|回复|給我|给我)\\s*${SIMPLIFIED}`,
);
// …unless it is negated: 不要用簡體、别用简体、避免简体.
const NEGATED = new RegExp(`(?:不要|不用|別|别|勿|避免|不能|不可以)[^。，,.!?！？\\n]{0,4}${SIMPLIFIED}`);
const ENGLISH = /\b(?:in|into|to|use)\s+simplified(?:\s+chinese)?\b|\bzh-(?:cn|hans)\b/i;

function wantsSimplified(prompt) {
  const text = String(prompt || '');
  if (NEGATED.test(text)) return false;
  return ASK.test(text) || ENGLISH.test(text);
}

function stateFile(dataDir, sessionId) {
  const safe = String(sessionId || 'default').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(dataDir || os.tmpdir(), `zhtw-guard-${safe}.json`);
}

function remember(dataDir, sessionId, wants) {
  try {
    const file = stateFile(dataDir, sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ wantsSimplified: wants }));
  } catch {
    // Losing this only means the reply gets checked as usual.
  }
}

function recall(dataDir, sessionId) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(dataDir, sessionId), 'utf8')).wantsSimplified === true;
  } catch {
    return false;
  }
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

module.exports = { wantsSimplified, remember, recall, stateFile, readStdin };
