---
name: security
description: Security audit of code or a feature. Checks OWASP Top 10, Python-specific vulnerabilities, ML security concerns, authentication/authorization, secrets handling, and dependency vulnerabilities. Flags issues by severity with specific remediation steps.
argument-hint: [file, endpoint, or directory to audit]
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob, Task
---

<objective>

Audit code for security vulnerabilities. Focus on issues that are exploitable by real attackers, ranked by severity. Provide specific, actionable fixes — not generic advice.

</objective>

<inputs>

- **$ARGUMENTS**: file, endpoint definition, or directory to audit.

</inputs>

<workflow>

## Step 1: Identify attack surface

- Entry points: HTTP endpoints, CLI args, file inputs, message queue consumers
- Trust boundaries: where does untrusted data enter the system?
- Sensitive operations: auth, payments, data access, privilege escalation

## Step 2: Parallel audit lanes

Launch three independent subagents simultaneously using the Task tool. Each agent receives the attack surface from Step 1 and audits its domain in isolation.

**Agent 1 — Python vulnerability scan**: Scan for dangerous deserialization (`pickle.loads`, `yaml.load` without `Loader=`), code execution sinks (`eval`, `exec`, `shell=True`, `os.system`), path traversal (unvalidated `open()` paths), and insecure temp files (`tempfile.mktemp`, hardcoded `/tmp/`).

**Agent 2 — OWASP Top 10 checklist**: Evaluate against A01 (Broken Access Control), A02 (Cryptographic Failures), A03 (Injection), A04 (Insecure Design), A05 (Security Misconfiguration), A07 (Authentication Failures), A08 (Dependency Vulnerabilities — run `pip-audit`, `safety check`), and A09 (Logging Failures). Return a checklist with pass/fail per item.

**Agent 3 — ML Security checks**: Audit supply chain for pre-trained models (source verification, checksum validation, pickle-based weight files), pickle usage in ML workflows (`torch.load`, `joblib.load` — check for `weights_only=True`), model poisoning risks (data provenance, federated learning defenses), adversarial input validation (image dimensions/dtype, text length, LLM prompt injection defenses).

## Step 3: Report

```
## Security Audit: [target]

### Critical (exploitable, fix immediately)
- [vuln] at [file:line]
  Risk: [what an attacker can do]
  Fix: [specific remediation]

### High (fix before next release)
- [vuln] at [file:line]
  Fix: [specific remediation]

### Medium (fix within sprint)
- [vuln] at [file:line]
  Fix: [specific remediation]

### Informational (harden when convenient)
- [finding]

### Dependency Scan
Run: pip-audit && safety check
Results: [paste output or "clean"]

### Supply Chain Security
```

\[ \] Dependencies pinned with hashes (uv pip compile --generate-hashes)
\[ \] GitHub Actions pinned to SHA (not just @v4 tag — tags can be moved)
\[ \] SLSA provenance: consider sigstore for signing release artifacts
\[ \] No install-time code execution (setup.py → pyproject.toml migration)
\[ \] Lockfile committed and CI uses --frozen / --locked

```

### ML Security
- Model sources: [trusted/untrusted]
- Pickle usage: [none/flagged locations]
- Input validation: [present/missing]
```

</workflow>

<notes>

- Focus on exploitable issues, not theoretical risks — every finding must have a concrete attack scenario
- Run `pip-audit` and `safety check` when dependency scanning; note if they're not installed
- For ML code: always check `torch.load` for `weights_only=True` and flag pickle-based weight files
- Follow-up chains:
  - Vulnerabilities found → `/fix` to apply specific remediations from the report
  - If fixes touch auth/input handling, re-run `/security` to verify the fix doesn't introduce new issues

</notes>
