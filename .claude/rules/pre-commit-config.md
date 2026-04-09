---
description: pre-commit configuration version pinning rules
paths:
  - .pre-commit-config.yaml
---

## Version Pinning

Two contexts; apply the right one:

**Live project config** (`.pre-commit-config.yaml` already exists and is in use):

- Run `pre-commit autoupdate` — this fetches the latest release tag for every hook
- Do NOT manually look up versions or use `pip install --upgrade` to determine the rev
- Commit the result of `pre-commit autoupdate` directly; do not modify the revs it sets

**Template / starter file** (creating a new config for others to copy):

- Use `<CURRENT>` as the rev placeholder — NEVER a real version string like `v0.5.0`
- Add the autoupdate comment on the same line:
  ```yaml
  rev: <CURRENT>  # run `pre-commit autoupdate` to set; verify release at the hook's repo
  ```

**New live project config** (creating `.pre-commit-config.yaml` for the first time for actual use, not as a template):

- Create a minimal config with placeholder revs, then immediately run `pre-commit autoupdate` to populate real versions
- Do NOT manually write version strings; autoupdate sets them correctly from the start
- To update a single hook rather than all hooks: `pre-commit autoupdate --repo <repo-url>`

Tip: run `pre-commit autoupdate` as part of regular dependency updates (e.g., monthly or when upgrading other deps).

## Version Verification

After running `pre-commit autoupdate`, cross-check the updated revs:

- **ruff**: https://pypi.org/project/ruff (or https://github.com/astral-sh/ruff/releases)
- **mypy**: https://pypi.org/project/mypy (or https://github.com/pre-commit/mirrors-mypy/tags)
- **pre-commit-hooks**: https://github.com/pre-commit/pre-commit-hooks/releases

Do NOT check only GitHub releases for ruff/mypy — pypi.org reflects the published package version.

<!-- URLs above are standard PyPI/GitHub package pages; verified as live public resources 2026-03-30. -->

## Prohibited Patterns

- `rev: latest` (not a valid git ref pattern; ambiguous)
- Using `pip install --upgrade <pkg>` to determine the hook rev (wrong ecosystem)
