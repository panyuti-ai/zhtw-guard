#!/usr/bin/env node
'use strict';

// Score every saved answer with the zhtw-guard checker and write
// results/scores.csv and results/summary.md.
//   node benchmark/score.js

const fs = require('fs');
const path = require('path');
const { check, stripQuoted } = require('../plugins/zhtw-guard/lib/checker');

const ROOT = __dirname;
const RAW = path.join(ROOT, 'results', 'raw');
const HAN = /\p{Script=Han}/gu;

// A fully Simplified answer has roughly 25-35% Simplified-only characters
// (the rest are shared by both scripts). Answers above WRITTEN are counted as
// written in Simplified; MIXED..WRITTEN usually add a Simplified version next
// to the Traditional one; below MIXED is quoting the source (「软件 → 軟體」).
// Every answer above MIXED in this run was also checked by hand.
const WRITTEN = 0.2;
const MIXED = 0.08;
const kind = (r) => {
  if (r.simplified === 0) return 'clean';
  const ratio = r.simplified / Math.max(1, r.han);
  return ratio >= WRITTEN ? 'written_simplified' : ratio >= MIXED ? 'mixed' : 'quotes_simplified';
};

const rows = [];
for (const provider of fs.existsSync(RAW) ? fs.readdirSync(RAW).sort() : []) {
  for (const file of fs.readdirSync(path.join(RAW, provider)).sort()) {
    const r = JSON.parse(fs.readFileSync(path.join(RAW, provider, file), 'utf8'));
    const { checked, findings } = check(r.answer);
    const han = (stripQuoted(r.answer).match(HAN) || []).length;
    const count = (type) => findings.filter((f) => f.type === type).reduce((n, f) => n + f.count, 0);
    rows.push({
      provider, model: r.model, prompt_id: r.prompt_id, category: r.category,
      variant: r.variant, rep: r.rep, checked, han,
      simplified: count('simplified'), kana: count('kana'), hangul: count('hangul'),
      simplified_chars: findings.filter((f) => f.type === 'simplified').map((f) => f.from).join(''),
    });
    rows[rows.length - 1].kind = kind(rows[rows.length - 1]);
  }
}

const csvCols = Object.keys(rows[0] || { provider: '' });
fs.writeFileSync(
  path.join(ROOT, 'results', 'scores.csv'),
  [csvCols.join(','), ...rows.map((r) => csvCols.map((c) => r[c]).join(','))].join('\n') + '\n',
);

function summarize(group) {
  const n = group.length;
  const bad = group.filter((r) => r.simplified + r.kana + r.hangul > 0).length;
  const han = group.reduce((s, r) => s + r.han, 0);
  const simp = group.reduce((s, r) => s + r.simplified, 0);
  const kh = group.filter((r) => r.kana + r.hangul > 0).length;
  const k = (name) => group.filter((r) => r.kind === name).length;
  const pct = (x) => (n ? ((100 * x) / n).toFixed(1) : '-') + '%';
  return [n, `${k('written_simplified')} (${pct(k('written_simplified'))})`, k('mixed'), k('quotes_simplified'),
    `${bad} (${pct(bad)})`, han ? ((1000 * simp) / han).toFixed(2) : '-', kh];
}

function table(title, keyFn) {
  const groups = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const lines = [`## ${title}`, '', '| group | answers | written in Simplified | mixed | quotes Simplified | any Simplified char | Simplified chars per 1,000 Han | kana/Hangul |', '|---|---|---|---|---|---|---|---|'];
  for (const [k, g] of [...groups].sort()) lines.push(`| ${k} | ${summarize(g).join(' | ')} |`);
  return lines.join('\n');
}

const models = [...new Set(rows.map((r) => `${r.provider}: ${r.model}`))].join('; ');
const md = [
  '# Results',
  '',
  `Answers scored: ${rows.length}. Models seen: ${models || '-'}.`,
  '',
  'Variant A: prompt as written. Variant B: prompt plus 「請用繁體中文回答。」',
  '',
  `Kinds, by share of Simplified-only characters among Han characters: written in Simplified >= ${WRITTEN * 100}%, mixed (adds a Simplified version) ${MIXED * 100}-${WRITTEN * 100}%, quotes Simplified (mentions source words) below ${MIXED * 100}%.`,
  '',
  table('By provider', (r) => r.provider),
  '',
  table('By provider and variant', (r) => `${r.provider} / ${r.variant}`),
  '',
  table('By provider and category', (r) => `${r.provider} / ${r.category}`),
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'results', 'summary.md'), md);
console.log(md);
