'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { wantsSimplified, remember, recall } = require('../plugins/zhtw-guard/lib/request');
const { decide } = require('../plugins/zhtw-guard/scripts/stop-hook');

test('explicit requests for Simplified are recognized', () => {
  for (const p of [
    '請用簡體中文回答',
    '用简体写一句：这个软件很好用',
    '把這段翻成簡體',
    '幫我改成简体中文',
    '以簡體輸出結果',
    'Please answer in Simplified Chinese.',
    'Translate this to simplified',
    'output zh-CN',
  ]) assert.equal(wantsSimplified(p), true, p);
});

test('mentions, negations and normal prompts are not requests', () => {
  for (const p of [
    '請把下面這段簡體文章整理成三個重點：「我们公司今年推出了新的云端服务」',
    '原文是簡體，請幫我摘要',
    '不要用簡體回答',
    '請用繁體中文回答，別用简体',
    '解釋 TCP 三向交握',
    '',
  ]) assert.equal(wantsSimplified(p), false, p);
});

test('state is kept per session and defaults to off', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhtw-guard-test-'));
  assert.equal(recall(dir, 'a'), false);
  remember(dir, 'a', true);
  remember(dir, 'b', false);
  assert.equal(recall(dir, 'a'), true);
  assert.equal(recall(dir, 'b'), false);
  remember(dir, 'a', false);
  assert.equal(recall(dir, 'a'), false);
});

test('when Simplified was requested, only kana and Hangul are checked', () => {
  const reply = '这个软件非常好用，欢迎大家下载试试看！';
  assert.equal(decide({ last_assistant_message: reply }, true), null);
  assert.ok(decide({ last_assistant_message: reply }, false));
  const withKana = decide({ last_assistant_message: reply + '这是测试です。' }, true);
  assert.match(withKana.hookSpecificOutput.additionalContext, /日文假名/);
  assert.doesNotMatch(withKana.hookSpecificOutput.additionalContext, /簡體字/);
});
