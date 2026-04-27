#!/usr/bin/env bash
# parse-resolve-args.sh — parse oss:resolve $ARGUMENTS, emit shell variable assignments
# Usage (Claude Code plugin — CLAUDE_PLUGIN_ROOT is set automatically):
#   eval "$(bash "${CLAUDE_PLUGIN_ROOT}/bin/parse-resolve-args.sh" "$ARGUMENTS")"
# Emits: PR_NUMBER, PR_URL, MODE, ARGUMENTS (leading '#' stripped only for comment-dispatch)

ARGUMENTS="$*"
PR_NUMBER=""
PR_URL=""
MODE=""

# Match PR number / URL / report-mode FIRST, before any string mutation —
# stripping leading '#' too eagerly would let "/oss:resolve '#42 looks wrong'"
# misroute through PR-number matching when it should go to comment dispatch.
if [[ "$ARGUMENTS" =~ ^[[:space:]]*#?([0-9]+)([[:space:]]+report)?[[:space:]]*$ ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
    if [ -n "${BASH_REMATCH[2]}" ]; then
        MODE="pr+report"
    else
        MODE="pr"
    fi
elif [[ "$ARGUMENTS" =~ ^[[:space:]]*(https://github\.com/[^[:space:]]+)([[:space:]]+report)?[[:space:]]*$ ]]; then
    PR_URL="${BASH_REMATCH[1]}"
    if [ -n "${BASH_REMATCH[2]}" ]; then
        MODE="pr+report"
    else
        MODE="pr"
    fi
elif [[ "$ARGUMENTS" =~ ^[[:space:]]*report[[:space:]]*$ ]]; then
    MODE="report"
else
    # Only now strip leading '#' — comment dispatch may carry it as Markdown header anchor
    ARGUMENTS="${ARGUMENTS#\#}"
    MODE="comment-dispatch"
fi

printf 'PR_NUMBER=%q\n' "$PR_NUMBER"
printf 'PR_URL=%q\n' "$PR_URL"
printf 'MODE=%q\n' "$MODE"
printf 'ARGUMENTS=%q\n' "$ARGUMENTS"
