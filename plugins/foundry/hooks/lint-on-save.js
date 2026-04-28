#!/usr/bin/env node
// lint-on-save.js — PostToolUse hook
//
// PURPOSE
//   Closes the gap between Claude editing a file and pre-commit running at
//   commit time. Auto-fixable violations are applied the moment they're
//   introduced. Pairs with md-compress.js: after the first Edit on any .md
//   file, this hook permanently normalizes it via pre-commit (mdformat,
//   trailing-whitespace). From that point, md-compress.js finds the file
//   already normalized and skips the write — both hooks converge to steady
//   state after first edit.
//
// WHY EXPLICIT --config
//   Hook fires globally across all projects. Passing --config with the
//   project-root .pre-commit-config.yaml ensures pre-commit uses the correct
//   project config, not one found by walking parent directories.
//
// HOW IT WORKS
//   1. Fires on every PostToolUse event for the Write and Edit tools.
//   2. Checks whether .pre-commit-config.yaml exists in the project root.
//      If absent, exits 0 silently — safe no-op in repos without pre-commit.
//   3. Runs `pre-commit run --config <configPath> --files <file_path>`
//      targeting only the changed file (no full-repo scan).
//   4. On success (exit 0) → silent, no output.
//      On failure (exit 1 or 2) → writes hook output to stderr and exits 2,
//      which causes Claude Code to surface the message as feedback so Claude
//      can immediately read it and apply the necessary fix.
//      If pre-commit exits non-zero with no output (e.g. no hooks apply to
//      the file type), this hook exits 0 silently — no false-positive block.
//
// EXIT CODES
//   0  All hooks passed, or pre-commit is not configured / not installed.
//   2  One or more hooks failed or auto-modified the file.
//      Claude Code treats exit 2 as "blocking feedback" — the output is shown
//      and Claude will re-read the file and/or apply corrections.
//
// PRE-COMMIT EXIT CODE MAPPING
//   pre-commit 0 → this hook exits 0 (silent pass)
//   pre-commit 1 → auto-fix applied (file changed) → exits 2 so Claude re-reads
//   pre-commit 2 → errors found → exits 2 so Claude sees the diagnostics
//
// TIMEOUT
//   60 s hard limit per invocation.  Heavy hooks (mypy, eslint full project)
//   should be configured with `--show-diff-on-failure` or `pass_filenames: false`
//   in .pre-commit-config.yaml to avoid slow single-file runs.
//

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(raw);
    const { hook_event_name, tool_name, tool_input, session_id } = data;

    // Only act on PostToolUse for Write or Edit
    if (hook_event_name !== "PostToolUse") process.exit(0);
    if (tool_name !== "Write" && tool_name !== "Edit") process.exit(0);

    const filePath = tool_input?.file_path;
    if (!filePath) process.exit(0);

    // Resolve project root (hooks run with CWD = project root)
    const root = process.cwd();

    // Skip files outside the project root (e.g. edits to ~/.claude/ files)
    const rel = path.relative(root, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);

    // Skip if no pre-commit config in this project
    const configPath = path.join(root, ".pre-commit-config.yaml");
    if (!fs.existsSync(configPath)) process.exit(0);

    // Deduplication lock — project and home settings.json both register this hook,
    // so two instances fire concurrently for every Edit. The second instance would
    // race pre-commit's own lock file and exit non-zero. Guard: if a lock file for
    // this exact file exists and is < 5s old, skip silently (already being linted).
    // Lock lives in the session-scoped tmpDir so it is cleaned up on SessionEnd
    // and cannot collide with other concurrent Claude sessions.
    const sid = (session_id || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    const tmpDir = path.join("/tmp", `claude-state-${sid}`);
    const sanitized = filePath.replace(/[^a-zA-Z0-9_-]/g, "_");
    const lockFile = path.join(tmpDir, `lock-lint-on-save-${sanitized}.lock`);
    try {
      const lockStat = fs.statSync(lockFile);
      if (Date.now() - lockStat.mtimeMs < 5_000) process.exit(0); // already running
    } catch (_) {} // lock absent — first instance, proceed
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(lockFile, String(process.pid));
    } catch (_) {}

    // Run pre-commit on the specific file
    const result = spawnSync("pre-commit", ["run", "--config", configPath, "--files", filePath], {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000, // 60s max — some hooks (mypy, eslint) can be slow
    });

    if (result.error) {
      // Missing pre-commit binary should not block Claude.
      if (result.error.code === "ENOENT") process.exit(0);
      const errMsg =
        result.error.code === "ETIMEDOUT"
          ? "pre-commit timed out after 60s"
          : `pre-commit failed to run: ${result.error.message}`;
      const out = [result.stdout, result.stderr, errMsg].filter(Boolean).join("\n").trim();
      process.stderr.write(out);
      process.exit(2);
    }

    if (result.status !== 0) {
      const raw = [result.stdout, result.stderr].filter(Boolean).join("\n");
      if (!raw.trim()) process.exit(0); // no hooks apply to this file type — silent pass
      // Strip dot-padded "Passed"/"Skipped" lines — only show failures and their sub-lines.
      // This prevents the narrow Claude Code blocking pane from wrapping hundreds of passing
      // hook lines and obscuring the actual failure.
      const filtered = raw
        .split("\n")
        .filter((line) => !/(Passed|Skipped)\s*$/.test(line))
        .join("\n")
        .trim();
      if (!filtered) process.exit(0);
      process.stderr.write(filtered);
      process.exit(2);
    }

    process.exit(0);
  } catch (_) {
    // Never block Claude — swallow all errors
    process.exit(0);
  }
});
