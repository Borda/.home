---
name: query
description: Query the codemap structural index — central, coupled, deps, rdeps, import path, symbol-level source extraction, and function-level call graph (fn-deps, fn-rdeps, fn-central, fn-blast).
argument-hint: <central [--top N] [--exclude-tests] | coupled [--top N] [--exclude-tests] | deps <module> | rdeps <module> [--exclude-tests] | path <from> <to> | symbol <name> [--limit N] [--exclude-tests] | symbols <module> | find-symbol <pattern> [--limit N] [--exclude-tests] | list | fn-deps <qname> | fn-rdeps <qname> [--exclude-tests] | fn-central [--top N] [--exclude-tests] | fn-blast <qname>> [--index <path>]
allowed-tools: Bash
effort: low
---

<objective>

Query codemap structural index for import-graph analysis, symbol-level source extraction, and function-level call graph traversal. **Python projects only** — index covers `.py` files; queries on non-Python projects return empty or error. `scan-query` on PATH (installed by the codemap plugin).

**Module-level queries** (import graph):
- `central [--top N]` — most-imported modules (highest blast radius, default top 10)
- `coupled [--top N]` — modules with most imports (highest coupling, default top 10)
- `deps <module>` — what module imports
- `rdeps <module>` — what imports module
- `path <from> <to>` — shortest import path between two modules

**Symbol-level queries** (use instead of reading full files — ~94% token reduction):
- `symbol <name>` — get source of a function/class/method by name
- `symbols <module>` — list all symbols in a module (no file I/O)
- `find-symbol <pattern>` — regex search across all symbol names in index

**Function-level call graph queries** (v3 index — requires `/codemap:scan` with call graph):
- `fn-deps <qname>` — what does this function/method call? (outgoing edges)
- `fn-rdeps <qname>` — what functions call this one? (incoming edges)
- `fn-central [--top N]` — most-called functions globally (default top 10)
- `fn-blast <qname>` — transitive reverse-call BFS with depth levels

Use `module::function` format for qname, e.g. `mypackage.auth::validate_token`. Requires v3 index — if index is v2, commands return a clear upgrade prompt.

NOT for: building or rebuilding index (use `/codemap:scan`).

</objective>

<workflow>

## Step 1: Run the query

**deps vs rdeps — choose before calling:**

| Task asks for... | Use | Why |
| --- | --- | --- |
| "which modules import X?" | `rdeps X` | callers, blast radius |
| "what imports X?" | `rdeps X` | callers |
| "modules affected if X changes?" | `rdeps X` | blast radius = reverse deps |
| "blast radius of X" | `rdeps X` | reverse deps |
| "what does X import?" | `deps X` | forward deps |
| "dependencies of X" | `deps X` | forward deps |

**Common mistake**: tasks asking "which modules need updating if X changes?" mean `rdeps` (callers), NOT `deps` (what X imports). `deps` returns the wrong direction and gives 0% recall.

Run `scan-query` via Bash:

```bash
# timeout: 20000
scan-query <QUERY_ARGS>
```

Replace `<QUERY_ARGS>`:

| Goal | Command |
| --- | --- |
| reverse deps | `rdeps <module>` |
| forward deps | `deps <module>` |
| central modules | `central --top 10` |
| coupling rank | `coupled --top 10` |
| import path | `path <from> <to>` |
| symbol source | `symbol <name>` |
| module symbols | `symbols <module>` |
| symbol search | `find-symbol <pattern>` |
| list modules | `list` |
| outgoing calls | `fn-deps module::function` |
| incoming calls | `fn-rdeps module::function` |
| most-called functions | `fn-central --top 10` |
| transitive callers | `fn-blast module::function` |

`scan-query` on PATH, locates index via git root — no setup. Missing index prints clear error.

Symbol names accept: bare name (`authenticate`), qualified name (`MyClass.authenticate`), or case-insensitive substring fallback. Function qnames use `module::function` format (e.g. `mypackage.auth::validate_token`). Index must be current — re-run `/codemap:scan` if stale warning appears.

## Step 2: Parse JSON output and format

`scan-query` always emits a JSON object — parse it before rendering. Also capture stderr: if it contains `[stale]` or `⚠ codemap index stale`, surface the warning to the user. Check `index.degraded` in the result; if `> 0`, caveat that some modules were unparsable.

| Command | JSON key to use | Render as |
| --- | --- | --- |
| `rdeps` / `deps` | `imported_by` / `direct_imports` | list modules, one per line |
| `central` / `coupled` | `central` / `coupled` array | list name + count with brief note |
| `path` | `path` array (or `null`) | chain `A → B → C → D`; if `null` → "No import path found." |
| `symbol` | `symbols[].source` | fenced code block; caption = module + line range |
| `symbols` | `symbols` array | `type name (lines start–end)`, one per line |
| `find-symbol` | `matches` array | `module:qualified_name (type)`, one per line |
| `list` | `modules` array | `module (path)`, one per line |
| `fn-deps` / `fn-rdeps` | `calls` / `called_by` | `module::function (resolution)`, one per line |
| `fn-central` | `fn_central` array | `count module::function`, one per line |
| `fn-blast` | `blast_radius` array | `depth module::function`, sorted by depth then name |

**exhaustive: true — stop immediately:** When `rdeps` or `deps` result contains `"exhaustive": true`, the list is complete and authoritative. Do NOT run grep, bash, or Glob passes to verify or extend it.

`{"error": "..."}`: surface error, suggest re-running `/codemap:scan`.

**Flags available on multiple commands** (`--exclude-tests`, `--limit`, `--index`):
- `--exclude-tests` — drop test modules from results; applies to: `rdeps`, `central`, `coupled`, `symbol`, `find-symbol`, `fn-rdeps`, `fn-central`
- `--limit N` (default 20, use `0` for all) — caps results on `symbol` and `find-symbol`; pass `--limit 0` before counting or ranking to avoid silent truncation
- `--index <path>` — explicit index file path (bypasses auto-discovery; useful for monorepos or comparing two indexes)

</workflow>
