# zhtw-guard

A Claude Code plugin for people who work with Claude in Traditional Chinese (Taiwan).

Claude often slips Mainland-China terms (軟件, 默認, 視頻), Simplified characters, or even stray Japanese and Korean into Traditional Chinese replies, even when `CLAUDE.md` asks for Taiwan usage ([anthropics/claude-code#46846](https://github.com/anthropics/claude-code/issues/46846), [anthropics/claude-code#95284](https://github.com/anthropics/claude-code/issues/95284)). A rule in a prompt is a request. `zhtw-guard` is a check: it runs after every reply and, when it finds a problem, asks Claude to rewrite the reply once.

## Install

In Claude Code:

```
/plugin marketplace add panyuti-ai/zhtw-guard
/plugin install zhtw-guard@zhtw-guard
```

Requires Node.js on `PATH` (no npm packages). Works on Windows, macOS, and Linux.

## What it checks

- **Mainland terms**, two levels:
  - *block*: almost never right in Taiwan writing (軟件→軟體, 默認→預設, 文件夾→資料夾, 線程→執行緒 …). Claude is asked to rewrite.
  - *warn*: right in some contexts (質量 is "mass" in physics, 項目 can mean "item"). You get a notice; Claude is not interrupted.
- **Simplified-only characters** (这, 们, 软 …). Characters that are also valid Traditional (后, 里, 么) are left alone.
- **Japanese kana and Korean** mixed into a Chinese reply.

Code blocks, inline code, and URLs are skipped. Replies with fewer than 10 Chinese characters are not checked, so English replies are left alone.

## How it behaves

1. Claude finishes a reply. The `Stop` hook reads `last_assistant_message`.
2. Block-level findings → Claude gets one rewrite request listing each fix.
3. If the rewrite still has problems, or only warn-level findings exist, you see a notice instead. Claude is asked at most once per reply, so it never loops.

The hook decodes its input as UTF-8 itself, so a Windows ANSI code page (cp950 on Traditional Chinese Windows) cannot garble the text before it is checked ([anthropics/claude-code#96285](https://github.com/anthropics/claude-code/issues/96285)).

## Limits

- A hook cannot edit what Claude already said; it can only ask for a rewrite, which costs one more turn.
- The word list is hand-curated and small on purpose. Missing terms are likely; false alarms are kept rare.

## Command line

The same checker works on files, for example to measure how often a model uses Mainland terms:

```
node plugins/zhtw-guard/scripts/check.js answer.md
```

It prints JSON and exits with 1 when a block-level finding exists.

## Development

```
node --test test/*.test.js
```

`plugins/zhtw-guard/lib/simplified-chars.js` is generated from [OpenCC](https://github.com/BYVoid/OpenCC) by `tools/build-simplified.py`.

---

## 中文說明

Claude 用繁體中文回答時，常混進「軟件、默認、視頻」這類大陸用語、簡體字，甚至日文或韓文；在 CLAUDE.md 寫了要台灣用語也一樣。`zhtw-guard` 會在每次回答後自動檢查，抓到確定錯的用字，就請 Claude 照清單重寫一次；依上下文才算錯的詞（例如「質量」「項目」）只提醒你，不打斷 Claude。程式碼、指令和網址不檢查。

## License

MIT. Includes data derived from OpenCC (Apache-2.0); see [NOTICE](NOTICE).
