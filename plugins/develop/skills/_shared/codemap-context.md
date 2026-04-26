**Structural context** (codemap, if installed) — soft PATH check, silently skip if `scan-query` not found:

```bash
PROJ=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if command -v scan-query >/dev/null 2>&1 && [ -f ".cache/scan/${PROJ}.json" ]; then
    scan-query central --top 5
fi
```

If results returned: prepend `## Structural Context (codemap)` block to foundry:sw-engineer spawn prompt with hotspot JSON. If `scan-query` not found or index missing: proceed silently — do not mention codemap to user.
