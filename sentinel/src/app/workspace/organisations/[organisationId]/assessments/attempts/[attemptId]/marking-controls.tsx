'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type MarkingTask = {
  task_id: string;
  task_title: string;
  maximum_score: string | number;
  required: boolean;
  response_id: string | null;
  mark_id: string | null;
  mark_version: number | null;
  awarded_score: string | number | null;
  marker_note: string | null;
};

type Props = {
  organisationId: string;
  attemptId: string;
  attemptStatus: string;
  latestDecisionType: string | null;
  tasks: MarkingTask[];
};

export function AssessmentMarkingControls({ organisationId, attemptId, attemptStatus, latestDecisionType, tasks }: Props) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(tasks.map(task => [task.task_id, task.awarded_score === null ? '' : String(task.awarded_score)])));
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(tasks.map(task => [task.task_id, task.marker_note ?? ''])));
  const [latestMarks, setLatestMarks] = useState<Record<string, { markId: string | null; markVersion: number | null; awardedScore: string | number | null }>>(() => Object.fromEntries(tasks.map(task => [task.task_id, { markId: task.mark_id, markVersion: task.mark_version, awardedScore: task.awarded_score }])));
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const correctionRequested = attemptStatus === 'marked' && latestDecisionType === 'correction_requested';
  const canMark = attemptStatus === 'submitted' || correctionRequested;

  async function submitMark(task: MarkingTask) {
    setError('');
    setMessage('');
    const rawScore = scores[task.task_id] ?? '';
    const score = Number(rawScore);
    const note = (notes[task.task_id] ?? '').trim();
    if (!task.response_id) return setError('This task has no captured response and cannot be marked.');
    if (rawScore.trim() === '' || !Number.isFinite(score) || score < 0 || score > Number(task.maximum_score)) {
      return setError('Enter a valid score between zero and the task maximum.');
    }
    const currentMark = latestMarks[task.task_id];
    if ((currentMark?.markId || correctionRequested) && !note) return setError('A reason is required when correcting an existing mark.');
    setBusyTask(task.task_id);
    try {
      const endpoint = correctionRequested
        ? `/api/organisations/${organisationId}/assessments/attempts/${attemptId}/corrections/marks`
        : `/api/organisations/${organisationId}/assessments/attempts/${attemptId}/marks`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.task_id, awardedScore: score, markerNote: note || null, supersedesMarkId: currentMark?.markId ?? null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save mark.');
      setLatestMarks(current => ({ ...current, [task.task_id]: { markId: payload.markId, markVersion: (current[task.task_id]?.markVersion ?? 0) + 1, awardedScore: score } }));
      setMessage('Mark saved to the append-only history.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save mark.');
    } finally {
      setBusyTask(null);
    }
  }

  async function finalize() {
    setError('');
    setMessage('');
    setFinalizing(true);
    try {
      const endpoint = correctionRequested
        ? `/api/organisations/${organisationId}/assessments/attempts/${attemptId}/corrections/finalize`
        : `/api/organisations/${organisationId}/assessments/attempts/${attemptId}/marking/finalize`;
      const response = await fetch(endpoint, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to finalise result.');
      setMessage('Immutable result version created.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to finalise result.');
    } finally {
      setFinalizing(false);
    }
  }

  const requiredTasksMarked = tasks.filter(task => task.required).every(task => Boolean(latestMarks[task.task_id]?.markId));
  const canFinalize = canMark && requiredTasksMarked && tasks.some(task => task.required);

  return <section className="mt-8 rounded-[18px] border border-[#DCE9ED] bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[14px] font-semibold text-[#18364E]">{correctionRequested ? 'Correct rejected result' : 'Task marking'}</h2><p className="mt-1 text-[11px] leading-5 text-[#7C91A0]">{correctionRequested ? 'A moderator requested correction. New marks must supersede the latest task mark and include a reason.' : 'Marks are stored separately from immutable response evidence. Corrections before finalisation create a new mark version.'}</p></div><span className="rounded-full bg-[#EAF5F4] px-3 py-1.5 text-[10px] font-semibold capitalize text-[#087F86]">{attemptStatus}</span></div>
    <div className="mt-5 space-y-4">
      {tasks.map(task => <div key={task.task_id} className="grid gap-3 border-t border-[#E8EEF2] pt-4 md:grid-cols-[1fr_130px_1fr_auto] md:items-end">
        <div><p className="text-[12px] font-semibold text-[#29465D]">{task.task_title}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">{task.required ? 'Required task' : 'Optional task — excluded from current result calculation'} · Maximum {task.maximum_score}</p>{latestMarks[task.task_id]?.markId && <p className="mt-1 text-[10px] text-[#087F86]">Latest mark version {latestMarks[task.task_id]?.markVersion}: {latestMarks[task.task_id]?.awardedScore}</p>}</div>
        {task.required && <label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#6D8292]">Awarded score</span><input type="number" min="0" max={Number(task.maximum_score)} step="0.01" value={scores[task.task_id] ?? ''} onChange={event => setScores(current => ({ ...current, [task.task_id]: event.target.value }))} disabled={!canMark || !task.response_id || Boolean(busyTask)} className="w-full rounded-xl border border-[#DCE7EC] px-3 py-2 text-[12px] text-[#18364E] outline-none focus:border-[#64BEB3] disabled:bg-[#F3F6F7]" /></label>}
        {task.required && <label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#6D8292]">Mark / correction reason</span><input type="text" value={notes[task.task_id] ?? ''} onChange={event => setNotes(current => ({ ...current, [task.task_id]: event.target.value }))} disabled={!canMark || !task.response_id || Boolean(busyTask)} placeholder={latestMarks[task.task_id]?.markId || correctionRequested ? 'Reason required' : 'Optional note'} className="w-full rounded-xl border border-[#DCE7EC] px-3 py-2 text-[12px] text-[#18364E] outline-none focus:border-[#64BEB3] disabled:bg-[#F3F6F7]" /></label>}
        {task.required && <button type="button" onClick={() => void submitMark(task)} disabled={!canMark || !task.response_id || busyTask !== null} className="rounded-full bg-[#087F86] px-4 py-2.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busyTask === task.task_id ? 'Saving…' : latestMarks[task.task_id]?.markId ? 'Save new version' : 'Save mark'}</button>}
      </div>)}
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#FFF2F0] px-3 py-2 text-[11px] text-[#A43D34]">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-[#EDF8F5] px-3 py-2 text-[11px] text-[#176E66]">{message}</p>}
    {canMark && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EEF2] pt-4"><p className="text-[10px] text-[#8498A7]">Finalisation is blocked until every required task has a latest mark.</p><button type="button" onClick={() => void finalize()} disabled={!canFinalize || finalizing} className="rounded-full border border-[#087F86] px-5 py-2.5 text-[10px] font-semibold text-[#087F86] disabled:cursor-not-allowed disabled:opacity-40">{finalizing ? 'Finalising…' : correctionRequested ? 'Finalise corrected result' : 'Finalise result'}</button></div>}
  </section>;
}
