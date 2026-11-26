'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type EligibleEnrolment = { enrolment_id: string; learner_reference: string; attempt_id: string | null; attempt_status: string | null };
type Props = { organisationId: string; eventId: string; eventStatus: string; learners: EligibleEnrolment[] };

export function EligibleLearnerControls({ organisationId, eventId, eventStatus, learners }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function startAttempt(enrolmentId: string) {
    setBusyId(enrolmentId); setError('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/events/${eventId}/attempts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrolmentId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to create learner attempt.');
      router.push(`/workspace/organisations/${organisationId}/assessments/attempts/${payload.attemptId}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create learner attempt.'); }
    finally { setBusyId(null); }
  }
  return <section className="mt-8 overflow-hidden rounded-[18px] border border-[#E1EAF0] bg-white">
    <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">Frozen eligible learner roster</h2><p className="mt-1 text-[11px] text-[#8498A7]">Eligibility was snapshotted when this event was scheduled. New enrolments do not silently enter this event.</p></div>
    {learners.length === 0 ? <p className="px-5 py-8 text-[12px] text-[#8498A7]">No frozen roster is available. Schedule the draft event to create its eligibility snapshot.</p> : <div className="divide-y divide-[#E8EEF2]">{learners.map(learner => <div key={learner.enrolment_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div><p className="text-[12px] font-semibold text-[#29465D]">{learner.learner_reference}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">Enrolment {learner.enrolment_id} · {learner.attempt_status ?? 'No attempt yet'}</p></div>{learner.attempt_id ? <Link className="rounded-full border border-[#CFE1E6] px-4 py-2 text-[10px] font-semibold text-[#087F86]" href={`/workspace/organisations/${organisationId}/assessments/attempts/${learner.attempt_id}`}>Open attempt</Link> : <button type="button" disabled={busyId !== null || eventStatus !== 'open'} onClick={() => void startAttempt(learner.enrolment_id)} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">{busyId === learner.enrolment_id ? 'Creating…' : 'Start attempt'}</button>}</div>)}</div>}
    {eventStatus !== 'open' && <p className="px-5 py-3 text-[10px] text-[#8A9CAB]">Attempts can only be started while the event is open.</p>}
    {error && <p role="alert" className="px-5 pb-4 text-[11px] text-[#A43D34]">{error}</p>}
  </section>;
}
