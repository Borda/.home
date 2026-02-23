---
name: security
description: Security audit of code or a feature. Checks OWASP Top 10, Python-specific vulnerabilities, ML security concerns, authentication/authorization, secrets handling, and dependency vulnerabilities. Flags issues by severity with specific remediation steps.
argument-hint: [file, endpoint, or directory to audit]
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob
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

## Step 2: Python-specific vulnerability scan

### Dangerous Deserialization

```bash
# pickle.loads on untrusted data — arbitrary code execution
grep -rn "pickle.loads\|pickle.load" . --include="*.py"
# Safe alternative: use JSON, MessagePack, or restrict to trusted sources only

# yaml.load without Loader — arbitrary code execution
grep -rn "yaml\.load(" . --include="*.py" | grep -v "Loader="
# Fix: yaml.safe_load() or yaml.load(data, Loader=yaml.SafeLoader)
```

### Code Execution Sinks

```bash
# eval/exec on untrusted input
grep -rn "\beval\b\|\bexec\b" . --include="*.py"

# subprocess with shell=True and user-controlled input
grep -rn "shell=True" . --include="*.py"
# Fix: use list form — subprocess.run(["cmd", arg], shell=False)

# os.system with user input
grep -rn "os\.system\b" . --include="*.py"
```

### Path Traversal

```bash
grep -rn "open(" . --include="*.py" | grep -v "test"
# Check if user-supplied paths are validated with pathlib.Path.resolve()
```

### Temporary Files

```bash
# Insecure temp files (predictable names)
grep -rn "tempfile\.mktemp\|\/tmp\/" . --include="*.py"
# Fix: use tempfile.mkstemp() or tempfile.TemporaryFile()
```

## Step 3: OWASP Top 10 checklist

### A01 — Broken Access Control

```
[ ] Authorization checked on every endpoint (not just authentication)
[ ] Vertical privilege escalation prevented (user can't call admin endpoints)
[ ] Horizontal privilege escalation prevented (user can't access other users' data)
[ ] IDOR: object IDs validated against the current user's permissions
[ ] Sensitive actions require re-authentication (password change, MFA disable)
[ ] Directory traversal prevented in file operations
```

### A02 — Cryptographic Failures

```
[ ] Sensitive data not stored in plaintext (passwords hashed with bcrypt/argon2)
[ ] PII not logged (emails, phone numbers, payment info)
[ ] Secrets not in source code, environment files not committed
[ ] HTTPS enforced for all endpoints (no HTTP fallback)
[ ] Weak algorithms not used (MD5/SHA1 for passwords, ECB cipher mode)
```

### A03 — Injection

```
[ ] SQL: parameterized queries used everywhere (no string concatenation)
[ ] Shell: subprocess called with list args, not shell=True with user input
[ ] NoSQL: query operators not injectable from user input
[ ] Template: auto-escaping on, no raw user input in templates
[ ] Path: user input sanitized before use in file paths
[ ] Python: no eval/exec on user input; no pickle.loads on untrusted data
```

### A04 — Insecure Design

```
[ ] Rate limiting on auth endpoints (brute force protection)
[ ] Account enumeration prevented (same error for wrong user and wrong password)
[ ] Sensitive operations are idempotent or use CSRF tokens
[ ] Business logic: can a user take an action multiple times they should do once?
```

### A05 — Security Misconfiguration

```
[ ] Debug mode disabled in production
[ ] Default credentials changed
[ ] Unnecessary endpoints / features disabled
[ ] Error messages don't expose stack traces or internal details to users
[ ] CORS is not set to wildcard (*) for credentialed requests
[ ] Security headers set: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
```

### A07 — Authentication Failures

```
[ ] Passwords: minimum length, bcrypt/argon2, no max length truncation
[ ] Sessions: invalidated on logout, rotated on privilege change
[ ] Tokens: short expiry, not stored in localStorage (use httpOnly cookies)
[ ] MFA: available for sensitive accounts
[ ] Password reset: token single-use, short-lived, not predictable
```

### A08 — Dependency Vulnerabilities

```bash
# Python — scan all three:
pip-audit                          # checks PyPI advisory database
safety check                       # alternative with broader DB
pip list --outdated                # identify outdated packages

# Check for known-bad versions in pyproject.toml or requirements.txt
```

### A09 — Logging Failures

```
[ ] Auth events logged (login success, failure, logout, MFA)
[ ] Sensitive data NOT logged (passwords, tokens, PII)
[ ] Logs are tamper-evident (append-only, shipped to external system)
[ ] Log injection prevented (user input sanitized before logging)
```

## Step 4: ML Security checks

### Supply Chain for Pre-trained Models

```
[ ] Model weights downloaded from official source (HuggingFace Hub, official repo)
[ ] Checksums verified after download (SHA256 from docs)
[ ] pickle-based model files (.pkl, .pt, .pth) from untrusted sources: HIGH RISK
    → Use safetensors format when available
[ ] Model cards reviewed for intended use and known biases
```

### Pickle in ML Workflows

```bash
# Find pickle usage in model loading
grep -rn "torch\.load\|pickle\.load\|joblib\.load" . --include="*.py"
# Fix: torch.load(path, weights_only=True)  # PyTorch 2.0+
# Fix: use safetensors.torch.load_file() for weights
```

### Model Poisoning & Data Integrity

```
[ ] Training data provenance verified (no untrusted external contributions without review)
[ ] Model weights from external sources validated (checksums, official hub downloads)
[ ] Fine-tuning on user-contributed data: sanitize inputs, limit influence per contributor
[ ] Federated learning: aggregation defenses against Byzantine participants (if applicable)
```

### Adversarial Input / Input Validation

```
[ ] Image inputs: validate dimensions, dtype, value range before inference
[ ] Text inputs: validate length, encoding; sanitize before passing to LLMs
[ ] LLM apps: prompt injection — user content should not alter system instructions
```

### LLM Prompt Injection (for apps using LLMs)

```
[ ] System prompt not overridable by user input
[ ] User-supplied content clearly delimited from instructions
[ ] Output from LLM not executed as code without review
[ ] PII not sent to external LLM APIs without consent/anonymization
```

## Step 5: Report

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
