"""Send every prompt to one provider and save the raw answers.

Usage:
  python benchmark/run.py claude [--reps 3] [--workers 3] [--limit N]
  python benchmark/run.py codex
  python benchmark/run.py codex --out codex-sol
  python benchmark/run.py gemini          # needs GEMINI_API_KEY
  ZHTW_GUARD_PLUGIN=plugins/zhtw-guard python benchmark/run.py claude_guard --ids 30,31,36 --variants A

Each answer is saved as results/raw/<provider>/<id>-<variant>-r<rep>.json.
Answers that already exist are skipped, so the script can be stopped and
re-run until everything is done.

Variants:
  A  the prompt as written (asked in Traditional Chinese, no instruction)
  B  the prompt plus 「請用繁體中文回答。」
"""
import argparse
import concurrent.futures
import datetime
import http.client
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
PROMPTS = json.loads((ROOT / "prompts/prompts.json").read_text(encoding="utf-8"))
VARIANTS = {"A": "", "B": "\n\n請用繁體中文回答。"}
GEMINI_MODEL = "gemini-3.8-flash"
# Codex does not report its model in --json output, so pin it.
# gpt-6.1-sol is first in the model list Codex 0.166.0 fetched for this account.
CODEX_MODEL = os.environ.get("CODEX_MODEL", "gpt-6.1-sol")
TIMEOUT = 600


def ask_claude(text):
    # Run in an empty folder with no settings, plugins or tools, so only
    # Claude Code's own default system prompt is in play.
    with tempfile.TemporaryDirectory() as cwd:
        out = subprocess.run(
            ["claude", "-p", text, "--output-format", "json",
             "--no-session-persistence", "--setting-sources", "", "--tools", ""],
            cwd=cwd, capture_output=True, timeout=TIMEOUT,
        )
    data = json.loads(out.stdout.decode("utf-8"))
    if data.get("is_error"):
        raise RuntimeError(data.get("result", "claude error"))
    models = list(data.get("modelUsage", {}))
    return data["result"], ",".join(models), {"cost_usd": data.get("total_cost_usd")}


def ask_claude_guard(text):
    # Same as ask_claude, with the zhtw-guard plugin loaded. Streams events so
    # the first answer (before any rewrite) and whether the hook fired are kept.
    plugin = os.environ.get("ZHTW_GUARD_PLUGIN", "")
    if not plugin:
        raise SystemExit("set ZHTW_GUARD_PLUGIN to the zhtw-guard plugin folder")
    with tempfile.TemporaryDirectory() as cwd:
        out = subprocess.run(
            ["claude", "-p", text, "--output-format", "stream-json", "--verbose",
             "--no-session-persistence", "--setting-sources", "", "--tools", "",
             "--plugin-dir", plugin],
            cwd=cwd, capture_output=True, timeout=TIMEOUT,
        )
    texts, asked_rewrite, result, models = [], False, None, []
    for line in out.stdout.decode("utf-8", "replace").splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("type") == "assistant":
            t = "".join(c.get("text", "") for c in d["message"]["content"] if c.get("type") == "text")
            if t:
                texts.append(t)
        elif d.get("subtype") == "hook_response" and "zhtw-guard" in d.get("output", ""):
            asked_rewrite = True
        elif d.get("type") == "result":
            if d.get("is_error"):
                raise RuntimeError(d.get("result", "claude error"))
            result, models = d.get("result"), list(d.get("modelUsage", {}))
    if result is None:
        raise RuntimeError(out.stderr.decode("utf-8", "replace")[-500:])
    return result, ",".join(models), {"first_answer": texts[0] if texts else "", "asked_rewrite": asked_rewrite}


def codex_bin():
    return os.environ.get("CODEX_BIN") or shutil.which("codex") or "codex"


def ask_codex(text):
    with tempfile.TemporaryDirectory() as cwd:
        last = pathlib.Path(cwd) / "last.txt"
        out = subprocess.run(
            [codex_bin(), "exec", "--skip-git-repo-check", "--ephemeral",
             "-m", CODEX_MODEL, "-s", "read-only", "-C", cwd, "--json", "-o", str(last), text],
            capture_output=True, timeout=TIMEOUT,
        )
        if out.returncode != 0 or not last.exists():
            raise RuntimeError(out.stderr.decode("utf-8", "replace")[-500:])
        answer = last.read_text(encoding="utf-8")
    return answer, CODEX_MODEL, {}


def ask_gemini(text):
    key = os.environ["GEMINI_API_KEY"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    body = json.dumps({"contents": [{"parts": [{"text": text}]}]}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    parts = data["candidates"][0]["content"]["parts"]
    answer = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    return answer, data.get("modelVersion", GEMINI_MODEL), {}


PROVIDERS = {"claude": ask_claude, "claude_guard": ask_claude_guard, "codex": ask_codex, "gemini": ask_gemini}


def run_one(provider, out_name, prompt, variant, rep):
    path = ROOT / "results/raw" / out_name / f"{prompt['id']:02d}-{variant}-r{rep}.json"
    if path.exists():
        return "skip"
    text = prompt["text"] + VARIANTS[variant]
    for attempt in range(6):
        started = time.time()
        try:
            answer, model, meta = PROVIDERS[provider](text)
            break
        except (OSError, http.client.HTTPException, RuntimeError,
                subprocess.TimeoutExpired, ValueError, KeyError) as e:
            wait = min(300, 15 * 2 ** attempt)
            print(f"{path.name}: {type(e).__name__} {str(e)[:120]}; retry in {wait}s", flush=True)
            time.sleep(wait)
    else:
        return "fail"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "provider": provider, "model": model, "prompt_id": prompt["id"],
        "category": prompt["category"], "variant": variant, "rep": rep,
        "prompt": text, "answer": answer,
        "finished_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "seconds": round(time.time() - started, 1), **meta,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("provider", choices=PROVIDERS)
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--out", default="", help="results folder name (default: provider), e.g. codex-sol")
    ap.add_argument("--ids", default="", help="comma-separated prompt ids, e.g. 30,31,36")
    ap.add_argument("--variants", default="AB", help="which variants to run, e.g. A")
    ap.add_argument("--limit", type=int, default=0, help="only the first N prompts (for a trial run)")
    args = ap.parse_args()

    prompts = PROMPTS[: args.limit] if args.limit else PROMPTS
    if args.ids:
        ids = {int(i) for i in args.ids.split(",")}
        prompts = [p for p in prompts if p["id"] in ids]
    jobs = [(p, v, r) for r in range(1, args.reps + 1) for p in prompts for v in VARIANTS if v in args.variants]
    counts = {"ok": 0, "skip": 0, "fail": 0}
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        futures = [pool.submit(run_one, args.provider, args.out or args.provider, *job) for job in jobs]
        for i, f in enumerate(concurrent.futures.as_completed(futures), 1):
            counts[f.result()] += 1
            if i % 10 == 0 or i == len(jobs):
                print(f"{args.out or args.provider}: {i}/{len(jobs)} {counts}", flush=True)


if __name__ == "__main__":
    main()
