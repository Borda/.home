---
name: review
description: Full code review orchestrating sw-engineer, qa-specialist, perf-optimizer, doc-scribe, linting-expert, security, and solution-architect agents in parallel. Produces structured findings across architecture, test coverage, performance, documentation, lint, security, and API design. Supports PR review mode and includes OSS-specific checks.
argument-hint: [file, directory, or PR number to review]
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task
---

<objective>
Perform a comprehensive code review by spawning specialized sub-agents in parallel and consolidating their findings into structured feedback with severity levels.
</objective>

<inputs>
- **$ARGUMENTS**: optional file path, directory, or PR number to review.
  - If a number is given (e.g. `42`): review the PR diff
  - If a path is given: review those files
  - If omitted: review recently changed files
</inputs>

<workflow>

## Step 1: Identify scope and context (run in parallel for PR mode)

```bash
# If $ARGUMENTS is a PR number — run all four in parallel:
gh pr diff $ARGUMENTS --name-only   # files changed in PR
gh pr view $ARGUMENTS               # PR description and metadata
gh pr checks $ARGUMENTS             # CI status — don't review if CI is red
gh pr view $ARGUMENTS --json reviews,labels,milestone

# If $ARGUMENTS is a path: use it directly

# If no argument: find recently changed files
git diff --name-only HEAD~1 HEAD
```

If CI is red, report that without full review.

## Step 2: Spawn sub-agents in parallel

Launch agents simultaneously with the Task tool (agents 6 and 7 are conditional):

**Agent 1 — sw-engineer**: Review architecture, SOLID adherence, type safety, error handling, and code structure. Check for Python anti-patterns (bare `except:`, `import *`, mutable defaults). Flag blocking issues vs suggestions.

**Agent 2 — qa-specialist**: Audit test coverage. Identify untested code paths, missing edge cases, and test quality issues. Check for ML-specific issues (non-deterministic tests, missing seed pinning). List the top 5 tests that should be added.

**Agent 3 — perf-optimizer**: Analyze code for performance issues. Look for algorithmic complexity issues, Python loops that should be NumPy/torch ops, repeated computation, unnecessary I/O. For ML code: check DataLoader config, mixed precision usage. Prioritize by impact.

**Agent 4 — doc-scribe**: Check documentation completeness. Find public APIs without docstrings, missing NumPy/Google style sections, outdated README sections, and CHANGELOG gaps. Verify examples actually run.

**Agent 5 — linting-expert**: Static analysis audit. Check ruff and mypy would pass. Identify type annotation gaps on public APIs, suppressed violations without explanation, and any missing pre-commit hooks. Flag mismatched target Python version.

**Agent 6 — security (optional, for PRs touching auth/input/deps)**: If the diff touches authentication, user input handling, dependency updates, or serialization — run the security skill's Python-specific vulnerability scan and OWASP checks. Skip if the PR is purely internal refactoring.

**Agent 7 — solution-architect (optional, for PRs touching public API boundaries)**: If the diff touches `__init__.py` exports, adds/modifies Protocols or ABCs, changes module structure, or introduces new public classes — evaluate API design quality, coupling impact, and backward compatibility. Skip if changes are internal implementation only.

## Step 3: Post-agent checks (run in parallel)

While agents from Step 3 are completing, run these two independent checks simultaneously:

### 3a: Ecosystem impact check (for libraries with downstream users)

```bash
# Check if changed APIs are used by downstream projects
CHANGED_EXPORTS=$(git diff HEAD~1 HEAD -- "src/**/__init__.py" | grep "^[-+]" | grep -v "^[-+][-+]" | grep -oP '\w+' | sort -u)
for export in $CHANGED_EXPORTS; do
  echo "=== $export ==="
  gh api "search/code?q=$export+in:file+language:python" --jq '.items[:5] | .[].repository.full_name' 2>/dev/null
done

# Check if deprecated APIs have migration guides
git diff HEAD~1 HEAD | grep -A2 "deprecated"
```

### 3b: OSS checks

```bash
# Check for new dependencies — license compatibility
git diff HEAD~1 HEAD -- pyproject.toml requirements*.txt

# Check for secrets accidentally committed
git diff HEAD~1 HEAD | grep -iE "(password|secret|api_key|token)\s*=\s*['\"][^'\"]{8,}"

# Check for API stability: are public APIs being removed without deprecation?
git diff HEAD~1 HEAD -- "src/**/__init__.py"

# Check CHANGELOG was updated
git diff HEAD~1 HEAD -- CHANGELOG.md CHANGES.md
```

## Step 4: Consolidate findings

```
## Code Review: [target]

### [blocking] Critical (must fix before merge)
- [bugs, security issues, data corruption risks]
- Severity: CRITICAL / HIGH

### Architecture & Quality
- [sw-engineer findings]
- [blocking] issues marked explicitly
- [nit] suggestions marked explicitly

### Test Coverage Gaps
- [qa-specialist findings — top 5 missing tests]
- For ML code: non-determinism or missing seed issues

### Performance Concerns
- [perf-optimizer findings — ranked by impact]
- Include: current behavior vs expected improvement

### Documentation Gaps
- [doc-scribe findings]
- Public API without docstrings listed explicitly

### Static Analysis
- [linting-expert findings — ruff violations, mypy errors, annotation gaps]

### API Design (if applicable)
- [solution-architect findings — coupling, API surface, backward compat]
- Public API changes: [intentional / accidental leak]
- Deprecation path: [provided / missing]

### OSS Checks
- New dependencies: [list, license status]
- API stability: [any public API removed without deprecation?]
- CHANGELOG: [updated / not updated]
- Secrets scan: [clean / found: file:line]

### Recommended Next Steps
1. [most important action]
2. [second most important]
3. [third]
```

</workflow>

<notes>
- Critical issues are always surfaced regardless of scope
- Skip sections where no issues were found — don't pad with "looks good"
- In PR mode: check CI status first — if red, report that without full review
- Blocking issues require explicit `[blocking]` prefix so author knows what must change
- Follow-up chains:
  - `[blocking]` bugs or regressions → `/fix` to reproduce with test and apply targeted fix
  - Structural or quality issues → `/refactor` for test-first improvements
  - Security findings in auth/input/deps → `/security` for a dedicated deep audit
</notes>
