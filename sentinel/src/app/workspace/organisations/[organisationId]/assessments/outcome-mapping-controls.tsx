'use client';

import { useCallback, useEffect, useState } from 'react';

type MappingRow = {
  task_id: string;
  task_code: string;
  task_title: string;
  required: boolean;
  mapping_id: string | null;
  curriculum_source_node_id: string | null;
  mapping_status: 'pending' | 'approved' | 'rejected' | null;
  created_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  outcome_code: string | null;
  outcome_title: string | null;
  document_code: string | null;
};
type Outcome = { id: string; node_code: string; title: string; document_code: string; grade: number; learning_area: string };
type Props = { organisationId: string; instrumentVersionId: string; actorUserId: string; instrumentStatus: string };

const controlClass = 'rounded-lg border border-[#DCE7EC] bg-white px-2.5 py-2 text-[10px] text-[#29465D] outline-none focus:border-[#73CFC2]';

export function OutcomeMappingControls({ organisationId, instrumentVersionId, actorUserId, instrumentStatus }: Props) {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const editable = instrumentStatus === 'draft' || instrumentStatus === 'in_review';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/instruments/${instrumentVersionId}/outcome-mappings`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load outcome mappings.');
      setRows(payload.mappings as MappingRow[]);
      setOutcomes(payload.availableOutcomes as Outcome[]);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load outcome mappings.');
    } finally {
      setLoading(false);
    }
  }, [organisationId, instrumentVersionId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/organisations/${organisationId}/assessments/instruments/${instrumentVersionId}/outcome-mappings`)
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load outcome mappings.');
        if (!cancelled) {
          setRows(payload.mappings as MappingRow[]);
          setOutcomes(payload.availableOutcomes as Outcome[]);
          setError('');
        }
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load outcome mappings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [organisationId, instrumentVersionId]);

  async function submit(path: string, body: unknown, label: string) {
    setBusy(label);
    setError('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The mapping operation failed.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The mapping operation failed.');
    } finally {
      setBusy('');
    }
  }

  const tasks = Array.from(new Map(rows.map(row => [row.task_id, row])).values());
  return <div className="mt-3 rounded-xl border border-[#E5EDF1] bg-[#FBFDFD] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#647D8D]">Curriculum outcome mapping</p>
      <span className="text-[9px] text-[#8A9CAB]">{outcomes.length} verified source outcome(s)</span>
    </div>
    {loading ? <p className="mt-2 text-[10px] text-[#8A9CAB]">Loading mapping evidence…</p> :
      <>
      {outcomes.length === 0 && <p className="mt-2 text-[10px] leading-5 text-[#8A9CAB]">No approved, rights-cleared specific outcomes are available for this exact curriculum edition and pathway. Curriculum extraction and source review must be completed before mapping.</p>}
      {tasks.map(task => {
        const taskMappings = rows.filter(row => row.task_id === task.task_id && row.mapping_id);
        const mappedIds = new Set(taskMappings.map(row => row.curriculum_source_node_id).filter((id): id is string => Boolean(id)));
        const available = outcomes.filter(outcome => !mappedIds.has(outcome.id));
        return <div key={task.task_id} className="mt-3 border-t border-[#E9EFF2] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-[10px] font-semibold text-[#29465D]">{task.task_code} · {task.task_title}</p><p className="mt-0.5 text-[9px] text-[#8A9CAB]">{task.required ? 'Required task' : 'Optional task'}</p></div>
          </div>
          {taskMappings.map(mapping => <div key={mapping.mapping_id} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-2">
            <div className="min-w-0 flex-1"><p className="text-[10px] text-[#29465D]">{mapping.outcome_code} · {mapping.outcome_title}</p><p className="mt-0.5 text-[9px] text-[#8A9CAB]">{mapping.document_code}</p></div>
            <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${mapping.mapping_status === 'approved' ? 'bg-[#E7F6F0] text-[#176B62]' : mapping.mapping_status === 'rejected' ? 'bg-[#FFF1EF] text-[#A43D34]' : 'bg-[#FFF7E8] text-[#8A5A14]'}`}>{mapping.mapping_status}</span>
            {mapping.mapping_status === 'pending' && mapping.created_by !== actorUserId && <div className="flex w-full flex-wrap gap-2 pt-1">
              <input value={notes[mapping.mapping_id!] || ''} onChange={event => setNotes(current => ({ ...current, [mapping.mapping_id!]: event.target.value }))} placeholder="Independent review note (min. 5 characters)" className={`min-w-[220px] flex-1 ${controlClass}`}/>
              <button type="button" disabled={busy !== '' || (notes[mapping.mapping_id!] || '').trim().length < 5} onClick={() => void submit(`/api/organisations/${organisationId}/assessments/outcome-mappings/${mapping.mapping_id}/review`, { decision: 'approved', reviewNote: notes[mapping.mapping_id!] }, 'approve')} className="rounded-full bg-[#087F86] px-3 py-2 text-[9px] font-semibold text-white disabled:opacity-40">Approve</button>
              <button type="button" disabled={busy !== '' || (notes[mapping.mapping_id!] || '').trim().length < 5} onClick={() => void submit(`/api/organisations/${organisationId}/assessments/outcome-mappings/${mapping.mapping_id}/review`, { decision: 'rejected', reviewNote: notes[mapping.mapping_id!] }, 'reject')} className="rounded-full border border-[#E6C7C2] px-3 py-2 text-[9px] font-semibold text-[#A43D34] disabled:opacity-40">Reject</button>
            </div>}
            {mapping.mapping_status === 'pending' && mapping.created_by === actorUserId && <span className="text-[9px] text-[#8A9CAB]">Awaiting independent review</span>}
            {mapping.review_note && <p className="w-full text-[9px] text-[#7D909F]">Review: {mapping.review_note}</p>}
          </div>)}
          {editable && available.length > 0 && <div className="mt-2 flex flex-wrap gap-2">
            <select value={selections[task.task_id] || ''} onChange={event => setSelections(current => ({ ...current, [task.task_id]: event.target.value }))} className={`min-w-[220px] flex-1 ${controlClass}`}>
              <option value="">Select an approved specific outcome…</option>
              {available.map(outcome => <option key={outcome.id} value={outcome.id}>{outcome.node_code} · {outcome.title} ({outcome.document_code})</option>)}
            </select>
            <button type="button" disabled={busy !== '' || !selections[task.task_id]} onClick={() => void submit(`/api/organisations/${organisationId}/assessments/instruments/${instrumentVersionId}/outcome-mappings`, { taskId: task.task_id, curriculumSourceNodeId: selections[task.task_id] }, 'propose')} className="rounded-full border border-[#CFE1E6] px-3 py-2 text-[9px] font-semibold text-[#087F86] disabled:opacity-40">Propose mapping</button>
          </div>}
        </div>;
      })}
      </>}
    {error && <p role="alert" className="mt-2 text-[10px] text-[#A43D34]">{error}</p>}
  </div>;
}
