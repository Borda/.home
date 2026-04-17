# Mode: Thread Analysis (Issue, Discussion, or PR)

All three are GitHub conversation threads — same analysis structure, different API fetch. `TYPE` is set by auto-detection in SKILL.md (`issue`, `discussion`, or `pr`). `NUMBER` = the item number (strip `discussion ` prefix if present).

## Agent Resolution

> **Foundry plugin check**: run `ls ~/.claude/plugins/cache/ 2>/dev/null | grep -q foundry` (exit 0 = installed). If the check fails or you are uncertain, proceed as if foundry is available — it is the common case; only fall back if an agent dispatch explicitly fails.

When foundry is **not** installed, substitute `foundry:X` references with `general-purpose` and prepend the role description plus `model: <model>` to the spawn call:

| foundry agent           | Fallback          | Model  | Role description prefix                                                                                           |
| ----------------------- | ----------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `foundry:sw-engineer`   | `general-purpose` | `opus` | `You are a senior Python software engineer. Write production-quality, type-safe code following SOLID principles.` |
| `foundry:qa-specialist` | `general-purpose` | `opus` | `You are a QA specialist. Write deterministic, parametrized pytest tests covering edge cases and regressions.`    |

Skills with `--team` mode: team spawning with fallback agents still works but produces lower-quality output.

**Cache check first**: if `$CACHE_FILE` exists — this variable is set by the parent `analyse/SKILL.md` Cache layer; see that file for the keying convention — read `item` and `comments` from it — skip the primary fetch. Still run wide-net searches (never cached). For PRs: `gh pr checks` and `gh pr diff` are never cached — always live.

If cache miss, run all fetches in parallel:

```bash
# --- run these in parallel ---

if [ "$TYPE" = "issue" ]; then

    gh issue view $NUMBER --json number,title,body,labels,comments,createdAt,author,state
    gh issue view $NUMBER --comments
    # After both complete: write cache (see SKILL.md Cache layer write pattern)

elif [ "$TYPE" = "pr" ]; then

    gh pr view $NUMBER --json number,title,body,labels,reviews,statusCheckRollup,files,additions,deletions,commits,author
    gh pr checks $NUMBER           # never cached — always live
    gh pr diff $NUMBER --name-only # never cached — always live
    # After pr view completes: write cache (see SKILL.md Cache layer write pattern)

else # discussion

    gh api graphql -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        discussion(number: $number) {
          title body createdAt closed closedAt
          author { login }
          category { name }
          answer { body author { login } createdAt }
          comments(first: 50) { nodes { body author { login } createdAt } }
          labels(first: 10) { nodes { name } }
        }
      }
    }' -f owner='{owner}' -f repo='{repo}' -F number=$NUMBER
    # If query returns null → print "⚠ Discussions not enabled or #N not found" and stop
    # After complete: write cache (see SKILL.md Cache layer write pattern)

fi

# Wide-net: same for all types — all related items open AND closed
TITLE=$(...) # extract from fetched item above

gh issue list --state all --search "$TITLE" --json number,title,state,labels --limit 50 |
jq --argjson self $NUMBER '[.[] | select(.number != $self)]'

gh pr list --state all --search "$TITLE" --json number,title,state --limit 30 |
jq --argjson self $NUMBER '[.[] | select(.number != $self)]'

gh api graphql -f query='
  query($owner:String!,$repo:String!){
    repository(owner:$owner,name:$repo){
      discussions(first:100,orderBy:{field:UPDATED_AT,direction:DESC}){
        nodes { number title closed }
      }
    }
  }' -f owner='{owner}' -f repo='{repo}' 2>/dev/null |
jq --arg q "$TITLE" --argjson self $NUMBER '
      .data.repository.discussions.nodes // [] |
      map(select(.number != $self) |
          select(.title | ascii_downcase | contains(($q | ascii_downcase | split(" ") | .[0]))))
    '
```

## Reproduction Check

Run immediately after the data fetch, before producing the report. Applies to **issues and discussions only** (skip for PRs — the Completeness checklist covers reproduction intent).

### Step R1: Detect reproducible example

Scan the thread body and all comments for any of:

- `Steps to Reproduce`, `Minimal Reproduction`, `MRE`, `Repro`, or similar section headings
- Fenced code blocks containing executable code (Python, shell, YAML, etc.)
- Explicit input → output examples or stack traces with triggering call sites
- Attached config files or test scripts

Set `HAS_REPRO=true` if any of the above is found; `HAS_REPRO=false` otherwise.

### Step R2: Sensitive pattern scan

Scan body and all comments for sensitive patterns. **Flag presence only — never include actual values in the report.**

| Pattern class                | Signals to detect                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Credentials / tokens         | `sk-`, `ghp_`, `Bearer `, PEM block headers, hex strings > 40 chars assigned to `key`/`token`/`secret`                  |
| PII in sample data           | Email addresses, phone numbers, full names embedded in data payloads                                                    |
| Internal infrastructure      | Private domain names (`.internal`, `.corp`, non-public TLDs), S3/GCS bucket paths with internal prefixes, database DSNs |
| Model / experiment internals | Private checkpoint paths, internal model registry URLs, internal W&B run IDs                                            |

Set `SENSITIVE_FLAGS=()` array; add one entry per class found (e.g., `"credentials"`, `"pii"`, `"internal_infra"`, `"model_internals"`).

### Step R3: Spawn agent (only when `HAS_REPRO=true`)

Extract the minimal reproduction code or steps from the thread. Choose the agent based on content:

- Code uses pytest / unittest / Python testing patterns → `foundry:qa-specialist`
- General Python / CLI / config reproduction → `foundry:sw-engineer`
- Language ambiguous or no code → `foundry:sw-engineer`

Spawn the chosen agent with this prompt (all context must be self-contained — this runs in a forked context):

```
Attempt to reproduce the issue in GitHub #<NUMBER>.

Extracted reproduction steps/code from the thread:
---
<paste the minimal code or steps verbatim>
---

Check:
1. Does the issue reproduce as described?
2. What Python / library version or environment is required?
3. Is anything missing or ambiguous (imports, data, config)?

Return ONLY a compact JSON envelope — nothing else:
{"status":"reproduced|not_reproduced|partial|missing_context","confidence":0.N,"notes":"<one observation max 15 words>","missing":"<what is missing, or null>"}
```

Collect the JSON envelope. `REPRO_STATUS` = `status` field.

### Step R4: Build the Reproduction block

Populate the `## Reproduction` block defined at the top of the `Produce:` template below, then include it at the start of the report file.

Status mapping: `reproduced` → ✅ · `not_reproduced` → ❌ · `partial` → ⚠ · `missing_context` → ⚠ (add missing detail) · `HAS_REPRO=false` → 🔍 No Example Provided · PR → ⏭ Skipped

Produce:

````
## Reproduction

**Status**: [✅ Reproduced | ❌ Could Not Reproduce | ⚠ Partial | 🔍 No Example Provided | ⏭ Skipped (PR)]
**Validation**: [agent result `notes`, or "No reproduction attempted"]
**Missing**: [agent `missing` field — omit line if null]
**Sensitive patterns**: [🔴 Found: <comma-separated flag names, no values> | ✅ None detected]

## Thread #[number]: [title]

**Type**: [Issue | Pull Request | Discussion]
**State**: [open/closed] | **Author**: @[author] | **Age**: [X days]
**Labels**: [labels, or "none"]
**Category**: [category]        ← discussion only; omit for issue/PR
**CI**: [passing/failing/pending]  ← PR only; omit for issue/discussion
**Size**: +[N]/-[N] lines, [N] files  ← PR only; omit for issue/discussion

### Summary
[2-3 sentence plain-language summary of the thread topic and current state]

### Thread Verdict
[Confirmed solution, accepted answer, or PR recommendation — or "No confirmed resolution."]

### Related Items

**⚠ Potential Duplicates** (same problem/question — suggest closing as duplicate):
- #N: [title] ([open/closed]) ← DUPLICATE — [why: same error / same root cause / same question]
  Canonical: #[lowest-number] — close others with "Closing as duplicate of #[canonical]"

**Related** (same area, distinct problem — cross-link):
- Issue #N: [title] ([state]) — [one-line distinction]
- PR #N: [title] ([state]) — [one-line distinction]
- Discussion #N: [title] — [one-line distinction]

_If no related items found: "No related items found."_

### Analysis

<!-- Issue: root cause + code evidence -->
**Root Cause Hypotheses** _(issue only)_:

| # | Hypothesis | Probability | Reasoning |
|---|-----------|-------------|-----------|
| 1 | [most likely cause] | [high/medium/low] | [why — reference specific code paths] |
| 2 | [alternative cause] | [medium/low] | [why] |

**Code Evidence** _(issue only)_:
```[language]
# [file:line] — [what this code does and why it relates to the hypothesis]
[relevant code snippet]
```

<!-- Discussion: viewpoints -->
**Key Viewpoints** _(discussion only)_:

| # | Position | Author | Support Level |
|---|----------|--------|---------------|
| 1 | [main viewpoint or request] | @[author] | [high/medium/low engagement] |
| 2 | [alternative viewpoint] | @[author] | [medium/low] |

<!-- PR: completeness + quality + risk -->
**Completeness** _(PR only)_:
_Legend: ✅ present · ⚠️ partial · ❌ missing · 🔵 N/A_
- [✅/⚠️/❌/🔵] Clear description of what changed and why
- [✅/⚠️/❌/🔵] Linked to a related issue (`Fixes #NNN` or `Relates to #NNN`)
- [✅/⚠️/❌/🔵] Tests added/updated (happy path, failure path, edge cases)
- [✅/⚠️/❌/🔵] Docstrings for all new/changed public APIs
- [✅/⚠️/❌/🔵] No secrets or credentials introduced
- [✅/⚠️/❌/🔵] Linting and CI checks pass

**Quality Scores** _(PR only)_:
- Code: n/5 — [reason]
- Testing: n/5 — [reason]
- Documentation: n/5 — [reason]

**Risk** _(PR only)_: n/5 [low/medium/high] — [description]
- Breaking changes: [none / detail]
- Performance: [none / detail]
- Security: [none / detail]

**Must Fix** _(PR only)_:
1. [blocking issue]

**Suggestions** _(PR only, non-blocking)_:
1. [improvement]

### Suggested Labels
[labels to add/remove]

### Suggested Response
[draft reply — or "close as duplicate of #X" — or "merge" / "request changes" for PRs]
[Use Markdown: wrap names in backticks, code samples in fenced blocks with language tag]

### Priority
[Critical / High / Medium / Low] — [rationale]  ← omit for discussions
````

Run `mkdir -p .reports/analyse/thread` then write the full report to `.reports/analyse/thread/output-analyse-thread-$NUMBER-$(date +%Y-%m-%d).md` using the Write tool — **do not print the full analysis to terminal**.

Read the compact terminal summary template from `.claude/skills/_shared/terminal-summaries.md` — use the **Issue Summary** template. Replace `[skill-specific path]` with `.reports/analyse/thread/output-analyse-thread-$NUMBER-$(date +%Y-%m-%d).md`, ensuring the block opens with `---` on its own line, the entity line follows on the next line, the `→ saved to <path>` line is present at the end, and the block closes with `---` on its own line after it. After printing to the terminal, also prepend the same compact block to the top of the report file using the Edit tool — insert it at line 1 so the file begins with the compact summary followed by a blank line, then the existing `## Thread #[number]:` content.

**⛔ DO NOT STOP — `REPLY_MODE=true`**: Skip the Confidence block here — it is emitted in SKILL.md Step 6 after the reply, or as the last step of SKILL.md if not in reply mode. Proceed **immediately** to the "Draft contributor reply" section in SKILL.md (Step 7). Your response is not complete until you have spawned shepherd and written the reply file.
