#!/usr/bin/env node
// Minimal statusline: model | cwd | billing | context bar
// Receives session JSON via stdin from Claude Code
//
// Billing detection:
//   - ANTHROPIC_API_KEY set → API key billing → show real cost in yellow ($X.XX)
//   - No API key          → OAuth subscription → show "<Plan> ~$X.XX" in cyan
//   Plan name inferred from context_window_size: ≥1M → Max, ≥200k → Pro, else Sub.
//   Note: cost.total_cost_usd is tokens × API rates — NOT actual subscription charge.
//   Subscription quota % is not exposed in hook data. Check /status for monthly usage.

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
    const isApiKey = !!process.env.ANTHROPIC_API_KEY;

    const ctxSize = context_window?.context_window_size ?? 0;
    // Infer plan from context window size: 1M tokens → Max, 200k → Pro, unknown → Sub
    const planName = ctxSize >= 1_000_000 ? 'Max' : ctxSize >= 200_000 ? 'Pro' : 'Sub';

    const parts = [];

    if (modelName) parts.push(`\x1b[2m${modelName}\x1b[0m`);
    if (dir)       parts.push(`\x1b[2m${dir}\x1b[0m`);

    if (isApiKey) {
      // API key billing — every token costs real money, show actual spend
      parts.push(`\x1b[33mAPI $${usd.toFixed(2)}\x1b[0m`);                      // yellow
    } else {
      // OAuth subscription (Pro / Max) — cost.total_cost_usd is theoretical API-rate
      // cost (tokens × published rates), NOT actual subscription charge or quota consumption.
      // Plan name inferred from context_window_size (1M = Max, 200k = Pro).
      // Use /status for actual monthly quota.
      parts.push(`\x1b[36m${planName} ~$${usd.toFixed(2)}\x1b[0m`);            // cyan plan + tilde
    }

    if (remaining !== null) {
      const pct = Math.max(0, Math.min(100, 100 - remaining));
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const color = pct < 50 ? 32 : pct < 75 ? 33 : 31;  // green / yellow / red
      parts.push(`\x1b[${color}m${bar} ${Math.round(pct)}%\x1b[0m`);
    }

    process.stdout.write(parts.join(' \x1b[2m│\x1b[0m '));
  } catch (e) {
    // Write error to temp file for debugging, show fallback statusline
    require('fs').appendFileSync('/tmp/statusline-debug.log',
      new Date().toISOString() + ' raw=' + JSON.stringify(raw.slice(0, 200)) + ' err=' + e.message + '\n');
    process.stdout.write('\x1b[2m?\x1b[0m');
  }
});
