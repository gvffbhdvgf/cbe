-- Preserve the audit trail itself as immutable history.
CREATE FUNCTION sentinel_private.prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is append-only and cannot be updated or deleted'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_audit_event_mutation();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_audit_event_mutation() FROM PUBLIC;
