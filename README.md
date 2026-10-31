# zhtw-guard

A Claude Code plugin for people who work with Claude in Traditional Chinese (Taiwan).

Claude sometimes slips Simplified characters, or even stray Japanese and Korean, into Traditional Chinese replies, even when `CLAUDE.md` asks for Traditional Chinese ([anthropics/claude-code#46846](https://github.com/anthropics/claude-code/issues/46846), [anthropics/claude-code#95284](https://github.com/anthropics/claude-code/issues/95284)). A rule in a prompt is a request. `zhtw-guard` is a check: it runs after every reply and, when it finds a problem, asks Claude to rewrite the reply once.

## Install

In Claude Code:

```
/plugin marketplace add panyuti-ai/zhtw-guard
/plugin install zhtw-guard@zhtw-guard
```

Requires Node.js on `PATH` (no npm packages). Works on Windows, macOS, and Linux.

## What it checks

- **Simplified-only characters** (这, 们, 软 …). Characters that are also valid Traditional (后, 里, 么) are left alone.
- **Japanese kana and Korean** mixed into a Chinese reply.

Code blocks, inline code, and URLs are skipped. Replies with fewer than 10 Chinese characters are not checked, so English replies are left alone.

Mainland-China wording written in Traditional characters (線程, 軟件) is **not** flagged. Many of these words are also used in Taiwan, and Taiwan's own official term lists include some of them, so flagging them would mostly annoy Taiwanese users. A dictionary-based check may come later.

## How it behaves

1. Claude finishes a reply. The `Stop` hook reads `last_assistant_message`.
2. If it finds anything, Claude gets one rewrite request listing each fix.
3. If the rewrite still has problems, you see a notice instead. Claude is asked at most once per reply, so it never loops.

If your prompt explicitly asks for Simplified Chinese (「用簡體回答」, 「翻成简体」, "in Simplified Chinese"), Simplified characters in that reply are left alone; kana and Korean are still checked. A `UserPromptSubmit` hook notes this per session; mentioning Simplified text (「原文是簡體」) or saying 「不要用簡體」 does not count as a request.

The hook decodes its input as UTF-8 itself, so a Windows ANSI code page (cp950 on Traditional Chinese Windows) cannot garble the text before it is checked ([anthropics/claude-code#96285](https://github.com/anthropics/claude-code/issues/96285)).

## Limits

- A hook cannot edit what Claude already said; it can only ask for a rewrite, which costs one more turn.

## Command line

The same checker works on files, for example to measure how often a model leaks Simplified characters:

```
node plugins/zhtw-guard/scripts/check.js answer.md
```

It prints JSON and exits with 1 when anything is found.

## Development

```
node --test test/*.test.js
```

`plugins/zhtw-guard/lib/simplified-chars.js` is generated from [OpenCC](https://github.com/BYVoid/OpenCC) by `tools/build-simplified.py`.

---

## 中文說明

Claude 用繁體中文回答時，偶爾會混進簡體字，甚至日文或韓文；在 CLAUDE.md 寫了要繁體中文也一樣。`zhtw-guard` 會在每次回答後自動檢查，抓到就請 Claude 重寫一次。程式碼、指令和網址不檢查。你明確要求簡體時（例如「用簡體回答」「翻成简体」），那一則就不抓簡體字。

「線程、軟件」這類用繁體字寫的大陸用語不會被抓：很多詞台灣也在用，連台灣官方的名詞表都有收錄，硬抓只會讓人煩。之後可能會加上以辭典為依據的檢查。

## License

MIT. Includes data derived from OpenCC (Apache-2.0); see [NOTICE](NOTICE).
