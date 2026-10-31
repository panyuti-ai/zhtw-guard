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

test('Mainland terms are found with the Taiwan term', () => {
  const r = check('這個軟件的默認文件夾在用戶目錄底下，請用鼠標點選設定。');
  const byFrom = Object.fromEntries(r.findings.map((f) => [f.from, f]));
  assert.equal(byFrom['軟件'].to, '軟體');
  assert.equal(byFrom['默認'].level, 'block');
  assert.equal(byFrom['文件夾'].to, '資料夾');
  assert.equal(byFrom['用戶'].level, 'warn');
});

test('longer term wins: 字符串 is not reported as 字符', () => {
  assert.deepEqual(froms('請把這個字符串轉成數字，然後再印出結果給使用者看。'), ['字符串']);
});

test('Simplified-only characters are found, shared ones are not', () => {
  const f = froms('这个程式会在后台运行，皇后住在城里，什么都不用改。');
  assert.ok(f.includes('这'));
  assert.ok(f.includes('会'));
  assert.ok(!f.includes('后'));
  assert.ok(!f.includes('里'));
  assert.ok(!f.includes('么'));
});

test('Japanese kana and Korean are found', () => {
  const r = check('這個功能已經完成了，接下來請確認です。測試也都通過了，沒有問題합니다。');
  const types = r.findings.map((f) => f.type).sort();
  assert.deepEqual(types, ['hangul', 'kana']);
});

test('code blocks, inline code and URLs are ignored', () => {
  const text =
    '下面是設定檔，內容請照抄，不要修改任何一個字元喔：\n' +
    '```\nname = "默認軟件"\n```\n' +
    '指令是 `install 软件`，說明在 https://example.com/视频 這一頁。';
  assert.deepEqual(froms(text), []);
});

test('English replies are not checked', () => {
  const r = check('Done. I renamed the 軟件 folder and updated the tests.');
  assert.equal(r.checked, false);
});

test('hook asks for one rewrite when blocking terms appear', () => {
  const out = decide({ last_assistant_message: '這個軟件的默認設定已經改好了，請重新啟動看看。', stop_hook_active: false });
  assert.equal(out.hookSpecificOutput.hookEventName, 'Stop');
  assert.match(out.hookSpecificOutput.additionalContext, /「軟件」→「軟體」/);
});

test('hook does not ask twice; it only tells the user', () => {
  const out = decide({ last_assistant_message: '這個軟件的默認設定已經改好了，請重新啟動看看。', stop_hook_active: true });
  assert.equal(out.hookSpecificOutput, undefined);
  assert.match(out.systemMessage, /軟件/);
});

test('warn-only findings never interrupt Claude', () => {
  const out = decide({ last_assistant_message: '這個專案的數據已經整理好了，請到報表頁面查看結果。', stop_hook_active: false });
  assert.equal(out.hookSpecificOutput, undefined);
  assert.match(out.systemMessage, /數據/);
});

test('clean reply produces no output', () => {
  assert.equal(decide({ last_assistant_message: '這個軟體的預設設定已經改好了，請重新啟動看看。' }), null);
});

test('correct Taiwan words that contain a term are not reported', () => {
  assert.deepEqual(froms('這個演算法的使用例句放在線上文件裡，大家都可以看到。'), []);
});

test('context-dependent words only warn', () => {
  const r = check('請記下錯誤代碼，再到餐廳菜單旁邊的公告欄查詢。');
  assert.ok(r.findings.length > 0);
  assert.ok(r.findings.every((f) => f.level === 'warn'));
});
