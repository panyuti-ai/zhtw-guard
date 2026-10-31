# Benchmark: Simplified-character leaks in Claude and GPT

How often do Claude and GPT slip Simplified Chinese characters, Japanese kana or Korean into answers that should be in Traditional Chinese (Taiwan)?

## Setup

- **50 prompts** in Traditional Chinese, four categories: technical concepts (13), daily life (12), working with a Simplified Chinese source text (13), code mixed with English (12). See [`prompts/prompts.json`](prompts/prompts.json).
- **Two variants** per prompt: A as written; B with 「請用繁體中文回答。」 appended.
- **3 runs** of each, because answers vary.
- **Tools**, as people actually use them:
  - Claude: Claude Code `claude -p`, empty folder, no settings or tools (default model at run time is recorded per answer).
  - GPT: Codex CLI `codex exec`, model pinned to `gpt-6.1-sol` (answers in `results/raw/codex-sol`).
  - Gemini: not included in this run. `run.py gemini` supports the Gemini API (`gemini-3.8-flash`), but the free tier's rate limits made 300 calls impractical.
- **Scoring** uses the zhtw-guard checker in `../plugins/zhtw-guard/lib/`: Simplified-only characters (characters also valid in Traditional are not counted), Japanese kana and Korean. Code blocks, inline code and URLs are skipped.

Mainland-style wording written in Traditional characters (軟件, 線程) is deliberately not counted: many such words are also used in Taiwan.

## With zhtw-guard

The three prompts where Claude answered in Simplified (30, 31, 36, variant A) were run 3 more times each with the zhtw-guard plugin loaded (`claude_guard`, answers in `results/raw/claude_guard`). Each answer keeps Claude's first reply and whether the hook asked for a rewrite.

Claude's first reply was in Simplified in 6 of 9 runs; the hook asked for a rewrite each time, and all 9 final answers contain no Simplified characters.

### Claude Haiku 5.5, full run

All 300 prompts/variants/reps were run with `CLAUDE_MODEL=claude-haiku-5-5`, once without the plugin (`results/raw/claude-haiku`) and once with it (`results/raw/claude_guard-haiku`).

| | written in Simplified | mixed | quotes Simplified | kana/Hangul |
|---|---|---|---|---|
| Haiku 5.5 | 15 | 7 | 16 | 3 |
| Haiku 5.5 + zhtw-guard | 0 | 0 | 5 | 0 |

zhtw-guard asked for a rewrite in 48 of 300 answers: 46 first replies contained Simplified characters, 2 contained Japanese phrases (prompt 14, a Japan travel question). Average time per answer: 11.8 s with the plugin, 12.2 s without.

## Run

```
python benchmark/run.py claude
ZHTW_GUARD_PLUGIN=plugins/zhtw-guard python benchmark/run.py claude_guard --ids 30,31,36 --variants A
CODEX_BIN=/path/to/codex python benchmark/run.py codex --out codex-sol
GEMINI_API_KEY=... python benchmark/run.py gemini
node benchmark/score.js
```

`run.py` skips answers already saved, so it can be stopped and resumed. Run from the repository root. Raw answers go to `benchmark/results/raw/`, scores to `benchmark/results/scores.csv` and `benchmark/results/summary.md`.

