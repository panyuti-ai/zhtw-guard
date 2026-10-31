#!/usr/bin/env node
'use strict';

// Command-line checker, for files or piped text:
//   node check.js answer.md other.md
//   type answer.md | node check.js        (Windows)
//   cat answer.md | node check.js         (macOS / Linux)
// Prints one JSON object per input. Exit code 1 when any block-level finding.

const fs = require('fs');
const { check } = require('../lib/checker');

function report(name, text) {
  const result = check(text);
  process.stdout.write(JSON.stringify({ file: name, ...result }) + '\n');
  return result.findings.some((f) => f.level === 'block');
}

const files = process.argv.slice(2);
let bad = false;
if (files.length === 0) {
  bad = report('<stdin>', fs.readFileSync(0).toString('utf8'));
} else {
  for (const f of files) bad = report(f, fs.readFileSync(f).toString('utf8')) || bad;
}
process.exitCode = bad ? 1 : 0;
