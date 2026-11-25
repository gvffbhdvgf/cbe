# Sentinel — Security & Environment Operations

## Secret-handling rules
- Never commit `.env`, `.env.local`, private keys, tokens, passwords or provider credentials.
- Commit only `.env.example` with variable names and non-secret placeholders.
- Keep local secrets in ignored files and use a password manager or OS secret store where practical.
- Store cloud credentials as encrypted/sensitive environment variables in the relevant provider.
- Use separate credentials for development, preview and production.
- Rotate credentials after suspected exposure and document the rotation.
- Do not paste secret values into Notion, GitHub issues, logs or chat.
- A plugin connection is an OAuth/authorised integration; do not attempt to extract its private credentials.

## Initial environment contract
Names are provisional; confirm against actual implementation before provisioning.

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Application database connection | Yes |
| `DIRECT_URL` | Direct database connection for migrations, if needed | Conditional |
| `AUTH_SECRET` | Session/token signing secret if selected auth design requires it | Conditional |
| `APP_BASE_URL` | Canonical application URL | Yes |
| `RESEND_API_KEY` | Resend transactional email, if selected | Conditional |
| `SENDERKIT_API_KEY` | SenderKit communications, if selected | Conditional |
| `EMAIL_FROM` | Verified sender identity | Conditional |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account context for server-side integration | Conditional |
| `R2_ACCESS_KEY_ID` | R2 scoped access key | Conditional |
| `R2_SECRET_ACCESS_KEY` | R2 scoped secret | Conditional |
| `R2_BUCKET_NAME` | Object-storage bucket | Conditional |

Do not configure both email providers by default. Choose one after defining notification requirements and delivery ownership.

## Vercel deployment guardrails
1. Inspect the connected project's Git settings before changes.
2. Disable production deployment from arbitrary branches.
3. Do not trigger a deployment for each commit.
4. Prefer manual production promotion or a dedicated release branch.
5. Keep preview deployment policy explicit and cost-aware.
6. Confirm ignored build step / deployment branch behaviour with a harmless test before relying on it.
7. Never add secrets until project identity and environment targets are confirmed.

## Access control
- Least privilege for users, services and plugins.
- Separate admin, school, teacher and read-only roles.
- Apply organisational scope to server-side reads, writes, exports and background jobs.
- Audit sensitive reads where appropriate, as well as writes and exports.
- Limit bulk export permissions.

## Data protection
Sentinel may process children's personal information. Before production, complete a documented privacy and safeguarding review covering lawful purpose, minimisation, notices, consent/guardian processes where applicable, retention, data subject requests, processors, breach response and controlled sharing.

## Operational checklist
- [ ] Development and production databases are separate.
- [ ] Environment files are excluded from Git.
- [ ] Secrets are encrypted at rest in cloud providers.
- [ ] Backups are configured and restoration tested.
- [ ] Audit events are retained and access-controlled.
- [ ] Production deploy requires explicit approval.
- [ ] Logs redact tokens, passwords and learner personal data.
- [ ] Incident and credential-rotation runbooks exist.
