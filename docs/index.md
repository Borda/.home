# Borda's AI-Rig

Claude Code is a capable generalist, but serious Python/ML OSS work demands more than a generalist can deliver: it needs an agent that enforces your SemVer, benchmarks its own accuracy drift, validates a feature with a demo test before writing production code, and reviews a PR through six specialist lenses in a single command. This suite exists because that gap is real and the workarounds — copy-pasted prompts, ad-hoc review checklists, hoping the model remembers your conventions — don't scale. What you get by reading further is a set of five composable plugins, each targeting one hard part of the practitioner's loop, that turn Claude Code from a smart REPL into a disciplined development partner.

## Plugins

| Plugin                  | Key goal                                       | What it does                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Foundry](foundry.md)   | **Sustainable AI-assisted dev infrastructure** | Packages the scaffolding that keeps specialised agents reliable over time: 8 domain agents, config lifecycle tools, quality gates (lint-on-save, teammate output quality), and a self-improvement loop via `/audit`, `/calibrate`, and `/distill`. |
| [OSS](oss.md)           | **Remove the maintainer context-switch tax**   | Runs parallel 6-agent review in one command, routes a Codex pre-pass to filter trivial PRs, crafts contributor-facing replies in your project's voice, and drives a SemVer-disciplined release pipeline with changelog and migration guides.       |
| [Develop](develop.md)   | **Proof before production code**               | Enforces a validation gate at every development mode — demo test before feature, regression test before fix, characterisation test before refactor — so no production code lands without evidence it solves the right problem.                     |
| [Research](research.md) | **Structured methodology for ML improvement**  | Closes the loop that causes most ML experiments to fail silently: SOTA literature search feeds a judge gate, which gates an auto-rollback run, with an optional team mode that exercises parallel hypotheses simultaneously.                       |
| [Codemap](codemap.md)   | **Instant structural answers, zero groping**   | Scans the import graph once and answers blast-radius, coupling, and dependency-path questions in a single JSON call — replacing the 20–30 Glob/Grep calls that otherwise open every session on a large codebase.                                   |

## Install

```bash
claude plugin marketplace add ./Borda-AI-Rig
claude plugin install foundry@borda-ai-rig
claude plugin install oss@borda-ai-rig
claude plugin install develop@borda-ai-rig
claude plugin install research@borda-ai-rig
claude plugin install codemap@borda-ai-rig
```

Post-install setup:

```
/foundry:init
```
