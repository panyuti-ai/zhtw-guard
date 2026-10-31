#!/usr/bin/env node
'use strict';

// Claude Code Stop hook. Reads the hook input as raw bytes and decodes it as
// UTF-8 itself, so a Windows ANSI code page (cp950 on Traditional Chinese
// Windows) cannot garble the reply before it is checked.

const { check, describe } = require('../lib/checker');
const { recall, readStdin } = require('../lib/request');

// allowSimplified: the user's prompt explicitly asked for Simplified Chinese,
// so only kana and Hangul are still checked.
function decide(input, allowSimplified = false) {
  const { checked, findings: all } = check(input.last_assistant_message);
  const findings = allowSimplified ? all.filter((f) => f.type !== 'simplified') : all;
  if (!checked || findings.length === 0) return null;

  const list = findings.map((f) => '- ' + describe(f)).join('\n');

  // Ask for one rewrite at most. If this reply is already the rewrite,
  // only tell the user what is left.
  if (!input.stop_hook_active) {
    const context =
      'zhtw-guard：上一則回答是寫給台灣讀者的繁體中文，但出現了下列用字。' +
      '請把整則回答用繁體中文重寫一次，內容不變，程式碼與指令保持原樣：\n' +
      list;
    return { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: context } };
  }

  return { systemMessage: 'zhtw-guard 提醒，重寫後仍有：\n' + list };
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return; // Never get in the way of Claude Code because of bad input.
  }
  const output = decide(input, recall(process.argv[2], input.session_id));
  if (output) process.stdout.write(JSON.stringify(output));
}

if (require.main === module) main();

module.exports = { decide };
