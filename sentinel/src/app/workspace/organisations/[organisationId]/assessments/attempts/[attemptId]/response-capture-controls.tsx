'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type CaptureTask = { task_id: string; task_title: string; response_type: string; required: boolean; response_id: string | null };
type Props = { organisationId: string; attemptId: string; eventStatus: string; attemptStatus: string; tasks: CaptureTask[] };

export function AssessmentResponseCaptureControls({ organisationId, attemptId, eventStatus, attemptStatus, tasks }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [captured, setCaptured] = useState<Set<string>>(() => new Set(tasks.filter(task => task.response_id).map(task => task.task_id)));
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canCapture = eventStatus === 'open' && attemptStatus === 'in_progress';
  const requiredComplete = tasks.filter(task => task.required).every(task => captured.has(task.task_id));
  async function capture(task: CaptureTask) {
    const value = (values[task.task_id] ?? '').trim();
    if (!value) { setError('Enter a response before saving it.'); return; }
    setBusyTask(task.task_id); setError(''); setMessage('');
    let parsed: unknown = value;
    if (task.response_type === 'numeric') {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) { setBusyTask(null); setError('Enter a valid number for this task.'); return; }
      parsed = numberValue;
    } else if (task.response_type === 'boolean') {
      if (!['true','false'].includes(value)) { setBusyTask(null); setError('Choose true or false.'); return; }
      parsed = value === 'true';
    }
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/attempts/${attemptId}/responses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.task_id, response: { value: parsed } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to capture response.');
      setCaptured(current => new Set([...current, task.task_id]));
      setMessage('Response evidence saved immutably.');
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to capture response.'); }
    finally { setBusyTask(null); }
  }
  async function submitAttempt() {
    setSubmitting(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/attempts/${attemptId}/submit`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to submit attempt.');
      setMessage('Attempt submitted. Captured evidence is now locked.');
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit attempt.'); }
    finally { setSubmitting(false); }
  }
  if (attemptStatus !== 'in_progress') return null;
  return <section className="mt-8 rounded-[18px] border border-[#D7E8E8] bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[14px] font-semibold text-[#18364E]">Learner response capture</h2><p className="mt-1 text-[11px] text-[#8498A7]">Each response is saved once as immutable evidence. Review carefully before saving.</p></div><span className="rounded-full bg-[#F0FAF8] px-3 py-1 text-[10px] font-semibold text-[#087F86]">{captured.size}/{tasks.length} captured</span></div>
    {tasks.map(task => <div key={task.task_id} className="mt-4 border-t border-[#E8EEF2] pt-4"><div className="flex items-center justify-between gap-3"><p className="text-[12px] font-semibold text-[#29465D]">{task.task_title}{task.required ? ' · Required' : ' · Optional'}</p><span className="text-[10px] text-[#8A9CAB]">{captured.has(task.task_id) ? 'Evidence saved' : task.response_type}</span></div>{!captured.has(task.task_id) && canCapture && <div className="mt-2 flex flex-wrap gap-2">{task.response_type === 'boolean' ? <select aria-label={`Response for ${task.task_title}`} value={values[task.task_id] ?? ''} onChange={event => setValues(current => ({ ...current, [task.task_id]: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-[#DCE7EC] px-3 py-2 text-[12px] text-[#29465D]"><option value="">Choose true or false</option><option value="true">True</option><option value="false">False</option></select> : <textarea aria-label={`Response for ${task.task_title}`} value={values[task.task_id] ?? ''} onChange={event => setValues(current => ({ ...current, [task.task_id]: event.target.value }))} rows={2} placeholder={task.response_type === 'numeric' ? 'Enter a number' : 'Enter learner response'} className="min-w-0 flex-1 rounded-xl border border-[#DCE7EC] px-3 py-2 text-[12px] text-[#29465D]" />}<button type="button" disabled={busyTask !== null} onClick={() => void capture(task)} className="self-start rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">{busyTask === task.task_id ? 'Saving…' : 'Save response'}</button></div>}</div>)}
    {canCapture && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EEF2] pt-4"><p className="text-[10px] text-[#8498A7]">{requiredComplete ? 'All required tasks have evidence.' : 'Save all required task responses before submitting.'}</p><button type="button" disabled={!requiredComplete || submitting} onClick={() => void submitAttempt()} className="rounded-full bg-[#102B45] px-5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40">{submitting ? 'Submitting…' : 'Submit attempt'}</button></div>}
    {eventStatus !== 'open' && <p className="mt-3 text-[10px] text-[#9AABB7]">Response capture is unavailable while the event is not open.</p>}
    {error && <p role="alert" className="mt-3 text-[11px] text-[#A43D34]">{error}</p>}{message && <p role="status" className="mt-3 text-[11px] text-[#087F86]">{message}</p>}
  </section>;
}
