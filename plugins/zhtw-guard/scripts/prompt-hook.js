#!/usr/bin/env node
'use strict';

// Claude Code UserPromptSubmit hook. Notes whether this prompt explicitly asks
// for Simplified Chinese. Prints nothing, so it never changes the prompt.
//   node prompt-hook.js <plugin data dir>

const { wantsSimplified, remember, readStdin } = require('../lib/request');

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return;
  }
  remember(process.argv[2], input.session_id, wantsSimplified(input.prompt));
}

main();
