'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DecisionType = 'moderation_approved' | 'moderation_rejected' | 'correction_requested' | 'result_approved' | 'result_published';

type Props = {
  organisationId: string;
  resultId: string;
  lifecycleStatus: string;
  moderationRequired: boolean;
  canApprove: boolean;
};

export function AssessmentResultDecisionControls({ organisationId, resultId, lifecycleStatus, moderationRequired, canApprove }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const available: DecisionType[] = lifecycleStatus === 'moderation_rejected'
    ? ['correction_requested']
    : moderationRequired && lifecycleStatus === 'marked'
      ? ['moderation_approved', 'moderation_rejected']
      : canApprove && ['marked', 'moderated'].includes(lifecycleStatus)
        ? ['result_approved']
        : canApprove && lifecycleStatus === 'approved'
          ? ['result_published']
          : [];

  const labels: Record<DecisionType, string> = {
    moderation_approved: 'Approve moderation',
    moderation_rejected: 'Reject moderation',
    correction_requested: 'Request correction',
    result_approved: 'Approve result',
    result_published: 'Publish result',
  };

  async function submit(decisionType: DecisionType) {
    setError('');
    setMessage('');
    if (!reason.trim()) return setError('A reason is required for every governance decision.');
    setBusy(true);
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/results/${resultId}/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionType, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to record decision.');
      setReason('');
      setMessage('Decision appended to the result history.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record decision.');
    } finally {
      setBusy(false);
    }
  }

  if (available.length === 0) return <p className="mt-2 text-[10px] text-[#8A9CAB]">No governance action is currently available for this result state.</p>;

  return <div className="mt-3 rounded-xl bg-[#F6F9FA] p-3">
    <label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#6D8292]">Decision reason</span><textarea value={reason} onChange={event => setReason(event.target.value)} rows={2} disabled={busy} className="w-full resize-y rounded-lg border border-[#DCE7EC] bg-white px-3 py-2 text-[11px] text-[#18364E] outline-none focus:border-[#64BEB3] disabled:bg-[#F3F6F7]" placeholder="Record the rationale for this decision"/></label>
    <div className="mt-2 flex flex-wrap gap-2">{available.map(decision => <button key={decision} type="button" onClick={() => void submit(decision)} disabled={busy || !reason.trim()} className="rounded-full border border-[#CFE1E6] bg-white px-3 py-2 text-[10px] font-semibold text-[#087F86] hover:bg-[#F0FAF8] disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving…' : labels[decision]}</button>)}</div>
    {error && <p role="alert" className="mt-2 text-[10px] text-[#A43D34]">{error}</p>}
    {message && <p role="status" className="mt-2 text-[10px] text-[#176E66]">{message}</p>}
  </div>;
}
