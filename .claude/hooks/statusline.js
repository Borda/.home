#!/usr/bin/env node
// Minimal statusline: model | cwd | context bar
// Receives session JSON via stdin from Claude Code

const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  try {
    const { model, workspace, context_window, cost } = JSON.parse(raw);

    const modelName = model?.display_name || model?.id || '';
    const dir = path.basename(workspace?.current_dir || process.cwd());
    const remaining = context_window?.remaining_percentage ?? null;
    const usd = cost?.total_cost_usd ?? 0;

    const parts = [];

    if (modelName) parts.push(`\x1b[2m${modelName}\x1b[0m`);
    if (dir)       parts.push(`\x1b[2m${dir}\x1b[0m`);

    // Billing indicator: API (pay-per-token) vs Sub (subscription plan)
    if (usd > 0) {
      parts.push(`\x1b[33m$${usd.toFixed(2)} API\x1b[0m`);   // yellow — costs money
    } else {
      parts.push(`\x1b[36mSub\x1b[0m`);                       // cyan — subscription
    }

    if (remaining !== null) {
      const pct = Math.max(0, Math.min(100, 100 - remaining));
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const color = pct < 50 ? 32 : pct < 75 ? 33 : 31;  // green / yellow / red
      parts.push(`\x1b[${color}m${bar} ${Math.round(pct)}%\x1b[0m`);
    }

    process.stdout.write(parts.join(' \x1b[2m│\x1b[0m '));
  } catch (_) {}
});
