# Sentinel

Sentinel is a curriculum-informed assessment and learning-improvement platform.

This directory is the isolated Sentinel project workspace within the `cbe` repository. Keep Sentinel application code, engineering documentation, infrastructure definitions and tests under this directory unless a repository-wide concern genuinely belongs at the root.

## Working principles

- Validate institutional workflows and requirements before implementation.
- Preserve curriculum version and assessment provenance.
- Keep learner identity independent from school enrolment.
- Distinguish raw marks, performance levels and curriculum-outcome mastery.
- Make analytics denominator-aware and auditable.
- Keep educators responsible for high-stakes decisions.
- Protect learner and guardian information with least-privilege access.

## Engineering workflow

1. Review the product brief, source assessment records and KICD curriculum references.
2. Record decisions and requirements before building domain features.
3. Use cloud-connected services and plugins for repository work, documentation, infrastructure and collaboration.
4. Commit coherent, reviewed changes to GitHub feature branches and keep Notion aligned.
5. Inspect deployment settings before enabling automation; ordinary commits must not trigger production deployments.
6. Validate cloud changes and preserve an auditable project handoff.

## Current status

The Sentinel discovery documentation is established on the `sentinel/bootstrap` branch. It includes product requirements, architecture, security/environment guidance, a project handoff and an aggregate assessment evidence audit. Application implementation has not started. Requirements remain subject to validation against the original implementation brief, exact assessment source files, KICD curriculum designs and institutional workflows.

See [Assessment Evidence Audit](docs/ASSESSMENT_EVIDENCE_AUDIT.md) for source inventory, confirmed aggregate findings and data-quality exceptions. See [KICD Curriculum Alignment Register](docs/CURRICULUM_ALIGNMENT_REGISTER.md) for the official Grade 6 and Grade 9 learning-area baseline and mapping controls.

## Cloud-first working mode

Use GitHub, Notion, Vercel, Neon, Cloudflare and other connected plugins directly. Do not use local-machine connectors, terminal/shell execution, desktop automation or ChatGPT Work unless the user explicitly changes this instruction. Prefer cloud-native repository edits and reviewable commits.

## Configuration

Never commit `.env` files, API tokens, private keys, database passwords, email credentials or other secrets. Commit only a sanitised `.env.example` containing variable names and safe placeholders.
