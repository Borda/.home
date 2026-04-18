#!/usr/bin/env bash
# Sync local plugin changes to ~/.claude/
# Run from the project root: bash sync.sh [--clean]
#
# After this script completes, run /foundry:init inside Claude Code
# to merge settings.json and refresh symlinks.

set -e

PLUGINS=(foundry oss develop research)
MARKETPLACE="borda-ai-rig"

if [[ "${1:-}" == "--clean" ]]; then
    echo "Uninstalling existing plugins..."
    for p in "${PLUGINS[@]}"; do
        claude plugin uninstall "${p}@${MARKETPLACE}" 2>/dev/null && echo "  ✓ uninstalled ${p}" || echo "  – ${p} not installed, skipping"
    done
fi

echo "Registering marketplace..."
claude plugin marketplace add ./

echo "Installing plugins..."
for p in "${PLUGINS[@]}"; do
    claude plugin install "${p}@${MARKETPLACE}" && echo "  ✓ ${p}"
done

echo "Initializing Foundry (sync settings + symlinks)..."
claude "/foundry:init --approve"

echo "✓ Done"
