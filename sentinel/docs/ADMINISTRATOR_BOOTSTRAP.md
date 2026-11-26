# Initial Platform Administrator Bootstrap

Status: first administrator bootstrap completed successfully on the isolated Neon development branch. This runbook remains the controlled procedure for future administrator provisioning and revocation.

## Current execution record

- The initial platform administrator completed Neon Auth email verification and password setup.
- The verified identity is active and has an active row in `public.platform_administrators` on the development branch.
- Public self-service sign-up remains disabled. Passwords, OTPs and reset tokens are not recorded in this document.
- Migration 0021 is applied to the development branch; the preview deployment remains separate from production.

## Preconditions

1. Confirm the active target is Neon project `sentinel-platform`, branch `sentinel-development`, database `sentinel`.
2. Create the first administrator's account through the approved Neon Auth administrative process. Do not enable public self-service sign-up.
3. Confirm the account email is verified and the account is not banned.
4. Record the account owner’s explicit approval for platform-administrator privileges. Do not infer authority from email domain, display name or account creation order.
5. Use the Neon SQL editor or approved database administration connection. Never put passwords, reset links or auth tokens in SQL or source control.

## Resolve the managed-auth user ID

Run this read-only query with the exact verified administrator email supplied through the secure administrative channel:

```sql
SELECT id
FROM neon_auth."user"
WHERE lower(email) = lower('<verified-administrator-email>')
  AND "emailVerified" IS TRUE
  AND COALESCE(banned, false) IS FALSE;
```

The result must contain exactly one row. If it returns zero or multiple rows, stop and resolve the account identity before proceeding.

## Grant platform-administrator access

Only after the preconditions and identity check pass, run on `sentinel-development`:

```sql
INSERT INTO public.platform_administrators (user_id)
SELECT id
FROM neon_auth."user"
WHERE lower(email) = lower('<verified-administrator-email>')
  AND "emailVerified" IS TRUE
  AND COALESCE(banned, false) IS FALSE
ON CONFLICT (user_id) DO NOTHING;
```

Then verify the row by joining to `neon_auth."user"` and confirming the expected verified account. The application checks `platform_administrators.status = 'active'` on every privileged onboarding request.

## Revoke access

To suspend platform-administrator privileges without deleting audit history:

```sql
UPDATE public.platform_administrators
SET status = 'suspended', updated_at = now()
WHERE user_id = '<managed-auth-user-uuid>';
```

Use `status = 'active'` only after an authorised review. For permanent revocation, set status to `revoked`; do not delete the row.

## Guardrails

- This bootstrap procedure is not an invitation workflow and does not create a user account.
- Do not run it on the Neon main branch or any production database.
- Do not copy learner or guardian data into this development environment.
- The first platform administrator should be a named, accountable person authorised by the product owner/institutional governance process.
- Record the approval and execution evidence in the restricted operational record, not in public project documentation.
- The development Neon Auth shared email provider is configured for one-time verification and password-reset codes. The owner completed the initial verification/password setup flow. Do not promise invitation or delivery behaviour beyond the configured OTP flow.
