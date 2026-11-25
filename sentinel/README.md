# Sentinel

Sentinel is being developed as a curriculum-informed assessment and learning-improvement platform.

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
3. Develop and test locally in an isolated Sentinel workspace.
4. Commit coherent changes to feature branches and sync them to GitHub.
5. Keep Notion project documentation aligned with implementation decisions.
6. Deploy only through an explicitly controlled release process; ordinary commits must not trigger production deployments.

## Current status

The repository was confirmed empty when this workspace was established. This README is the first project file. The detailed working blueprint is maintained in the Sentinel Notion documentation.

## Configuration

Never commit `.env` files, API tokens, private keys, database passwords, email credentials or other secrets. Commit only a sanitised `.env.example` containing variable names and safe placeholders.
