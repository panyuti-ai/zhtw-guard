'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { check } = require('../plugins/zhtw-guard/lib/checker');
const { decide } = require('../plugins/zhtw-guard/scripts/stop-hook');

const froms = (text) => check(text).findings.map((f) => f.from);

test('clean Taiwan text has no findings', () => {
  const r = check('這個軟體的預設資料夾在使用者目錄底下，請用滑鼠點選設定，再重新啟動程式。');
  assert.equal(r.checked, true);
  assert.deepEqual(r.findings, []);
});

test('Mainland terms written in Traditional characters are not flagged', () => {
  assert.deepEqual(froms('線程和進程的差別在於記憶體，死鎖時要檢查上下文切換，軟件也一樣。'), []);
});

test('Simplified-only characters are found, shared ones are not', () => {
  const f = froms('这个程式会在后台运行，皇后住在城里，什么都不用改。');
  assert.ok(f.includes('这'));
  assert.ok(f.includes('会'));
  assert.ok(!f.includes('后'));
  assert.ok(!f.includes('里'));
  assert.ok(!f.includes('么'));
});

test('Simplified finding carries the Traditional form', () => {
  const r = check('请把这个设定改好，再重新启动一次程式看看结果。');
  const zhe = r.findings.find((f) => f.from === '这');
  assert.equal(zhe.to, '這');
});

test('Japanese kana and Korean are found', () => {
  const r = check('這個功能已經完成了，接下來請確認です。測試也都通過了，沒有問題합니다。');
  const types = r.findings.map((f) => f.type).sort();
  assert.deepEqual(types, ['hangul', 'kana']);
});

test('code blocks, inline code and URLs are ignored', () => {
  const text =
    '下面是設定檔，內容請照抄，不要修改任何一個字元喔：\n' +
    '```\nname = "这是です"\n```\n' +
    '指令是 `install 软件`，說明在 https://example.com/视频 這一頁。';
  assert.deepEqual(froms(text), []);
});

test('English replies are not checked', () => {
  const r = check('Done. I renamed the 这 folder and updated the tests.');
  assert.equal(r.checked, false);
});

test('hook asks for one rewrite when something is found', () => {
  const out = decide({ last_assistant_message: '这个设定已經改好了，請重新啟動程式看看結果。', stop_hook_active: false });
  assert.equal(out.hookSpecificOutput.hookEventName, 'Stop');
  assert.match(out.hookSpecificOutput.additionalContext, /簡體字「这」→「這」/);
});

test('hook does not ask twice; it only tells the user', () => {
  const out = decide({ last_assistant_message: '这个设定已經改好了，請重新啟動程式看看結果。', stop_hook_active: true });
  assert.equal(out.hookSpecificOutput, undefined);
  assert.match(out.systemMessage, /这/);
});

test('clean reply produces no output', () => {
  assert.equal(decide({ last_assistant_message: '這個軟體的預設設定已經改好了，請重新啟動看看。' }), null);
});
