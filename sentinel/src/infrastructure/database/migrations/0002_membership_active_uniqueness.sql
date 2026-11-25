CREATE UNIQUE INDEX IF NOT EXISTS organisation_memberships_one_active_per_user_idx ON public.organisation_memberships (organisation_id, user_id) WHERE status = 'active';
