-- Require at least one new, reasoned task-mark version before a rejected result can be re-finalised.

CREATE FUNCTION sentinel_private.require_corrected_assessment_mark()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_correction_requested_at timestamptz;
BEGIN
  IF NEW.result_version <= 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.supersedes_result_id IS NULL THEN
    RAISE EXCEPTION 'A corrected result must identify the result it supersedes' USING ERRCODE = '23514';
  END IF;

  SELECT decision.decided_at INTO v_correction_requested_at
  FROM public.assessment_result_decisions AS decision
  WHERE decision.result_id = NEW.supersedes_result_id
    AND decision.attempt_id = NEW.attempt_id
    AND decision.organisation_id = NEW.organisation_id
    AND decision.decision_type = 'correction_requested'
  ORDER BY decision.decided_at DESC, decision.id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A recorded moderation correction request is required before a corrected result can be created' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assessment_response_marks AS mark
    INNER JOIN public.assessment_tasks AS task
      ON task.id = mark.task_id
     AND task.tenant_organisation_id = mark.tenant_organisation_id
     AND task.organisation_id = mark.organisation_id
     AND task.instrument_version_id = mark.instrument_version_id
    WHERE mark.tenant_organisation_id = NEW.tenant_organisation_id
      AND mark.organisation_id = NEW.organisation_id
      AND mark.attempt_id = NEW.attempt_id
      AND mark.instrument_version_id = NEW.instrument_version_id
      AND mark.supersedes_mark_id IS NOT NULL
      AND mark.marked_at > v_correction_requested_at
      AND task.required = true
  ) THEN
    RAISE EXCEPTION 'At least one required task mark must be corrected with a new version before corrected result finalization' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.require_corrected_assessment_mark() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER assessment_results_correction_requires_new_mark
BEFORE INSERT ON public.assessment_results
FOR EACH ROW
EXECUTE FUNCTION sentinel_private.require_corrected_assessment_mark();
