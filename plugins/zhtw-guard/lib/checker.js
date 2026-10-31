'use strict';

const simplified = require('./simplified-chars');

// Replies with fewer Han characters than this are treated as not written in
// Chinese, so an English reply that quotes one Chinese word is left alone.
const MIN_HAN = 10;

const HAN = /\p{Script=Han}/gu;
const KANA = /[ぁ-ゖァ-ヺ]/u;
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/u;

// Text that is quoted on purpose: fenced code, inline code, links.
function stripQuoted(text) {
  return text
    .replace(/(```|~~~)[\s\S]*?(\1|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

function add(found, key, entry) {
  const hit = found.get(key);
  if (hit) hit.count += 1;
  else found.set(key, { ...entry, count: 1 });
}

// Returns { checked, findings }. checked is false when the text is not
// Chinese enough to judge. Each finding is
// { type: 'simplified' | 'kana' | 'hangul', from, to, count }.
function check(text) {
  const body = stripQuoted(String(text || ''));
  const han = body.match(HAN) || [];
  if (han.length < MIN_HAN) return { checked: false, findings: [] };

  const found = new Map();
  for (const c of body) {
    if (simplified.has(c)) {
      add(found, 'simplified:' + c, { type: 'simplified', from: c, to: simplified.get(c) });
    } else if (KANA.test(c)) {
      add(found, 'kana', { type: 'kana', from: c, to: '' });
    } else if (HANGUL.test(c)) {
      add(found, 'hangul', { type: 'hangul', from: c, to: '' });
    }
  }
  return { checked: true, findings: [...found.values()] };
}

function describe(f) {
  if (f.type === 'simplified') return `簡體字「${f.from}」→「${f.to}」`;
  if (f.type === 'kana') return `混入日文假名（例如「${f.from}」）`;
  return `混入韓文（例如「${f.from}」）`;
}

module.exports = { check, describe, stripQuoted, MIN_HAN };
