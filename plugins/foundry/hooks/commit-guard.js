// commit-guard.js — PreToolUse hook
//
// PURPOSE
//   Claude must never commit autonomously. The commit discipline rule
//   ("never commit without explicit user request in same message") lives in
//   a prompt instruction — not enforced at runtime. This hook enforces it
//   at the tool level: every `git commit` Bash call is blocked unless a
//   skill explicitly opted in via a sentinel file for that repo+branch.
//
//   Skills that legitimately commit as part of their workflow (oss:resolve,
//   research:run) create the sentinel at the start of their commit phase and
//   delete it immediately after. Ad-hoc Claude behavior — pattern-matching
//   from conversation context, "finishing a task" — never creates the sentinel,
//   so those commits are blocked and the user sees clear feedback.
//
//   Sentinel path: /tmp/claude-commit-auth-<repo-slug>-<branch-slug>
//   TTL: 15 min — auto-expires if a skill crashes before cleanup.
//
// HOW IT WORKS
//   1. Only fires on Bash tool calls containing `git commit`.
//   2. Derives repo slug (basename of git root) and branch slug.
//   3. Checks sentinel path exists and is younger than TTL.
//   4. Sentinel valid → exit 0 (allow). Missing or expired → exit 2 (block).
//
// EXIT CODES
//   0  Sentinel present and fresh — commit allowed.
//   2  No sentinel or expired — commit blocked; stderr shown to Claude.

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TTL_MS = 15 * 60 * 1000; // 15 minutes

function toSlug(s) {
  return s.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
}

function getSentinelPath() {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const repoSlug = toSlug(path.basename(root));
    const branch = execSync("git branch --show-current", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!branch) return null; // detached HEAD
    const branchSlug = toSlug(branch);
    return `/tmp/claude-commit-auth-${repoSlug}-${branchSlug}`;
  } catch {
    return null;
  }
}

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const { tool_name, tool_input } = data;

  if (tool_name !== "Bash") process.exit(0);

  const command = (tool_input && tool_input.command) || "";

  if (!/^\s*git commit\b/.test(command)) process.exit(0);

  const sentinel = getSentinelPath();
  if (!sentinel) {
    process.stderr.write(
      "git commit blocked — could not determine repo/branch for authorization check.\n" +
        "Ensure you are inside a git repository on a named branch (not detached HEAD).\n",
    );
    process.exit(2);
  }

  let stat;
  try {
    stat = fs.statSync(sentinel);
  } catch {
    process.stderr.write(
      `git commit blocked — no commit authorization for this branch.\n` +
        `Skills like /oss:resolve and /research:run set this automatically.\n` +
        `For ad-hoc commits: invoke AskUserQuestion to confirm, ` +
        `then touch ${sentinel} before git commit, rm -f ${sentinel} after.\n`,
    );
    process.exit(2);
  }

  const ageMs = Date.now() - stat.mtimeMs;
  if (ageMs > TTL_MS) {
    try {
      fs.unlinkSync(sentinel);
    } catch {
      // best-effort cleanup
    }
    process.stderr.write(
      `git commit blocked — authorization expired (15-min TTL).\n` +
        `Re-run the skill or touch ${sentinel} after user confirmation.\n`,
    );
    process.exit(2);
  }

  process.exit(0);
});
