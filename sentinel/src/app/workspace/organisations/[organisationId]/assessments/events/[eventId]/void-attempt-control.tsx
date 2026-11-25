'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { organisationId: string; attemptId: string; attemptStatus: string; eventEndsAt: string };

export function AssessmentAttemptVoidControl({ organisationId, attemptId, attemptStatus, eventEndsAt }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (attemptStatus !== 'in_progress' || new Date(eventEndsAt).getTime() > Date.now()) return null;

  async function voidAttempt() {
    setError('');
    if (!reason.trim()) return setError('A reason is required.');
    setBusy(true);
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/attempts/${attemptId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to void attempt.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to void attempt.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 rounded-xl bg-[#F6F9FA] p-3"><label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#6D8292]">Reason to void incomplete attempt</span><input value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="w-full rounded-lg border border-[#DCE7EC] bg-white px-3 py-2 text-[11px] text-[#18364E]" placeholder="Required reason"/></label><button type="button" onClick={() => void voidAttempt()} disabled={busy || !reason.trim()} className="mt-2 rounded-full border border-[#CFA8A4] px-3 py-2 text-[10px] font-semibold text-[#A43D34] disabled:opacity-40">{busy ? 'Saving…' : 'Void incomplete attempt'}</button>{error && <p role="alert" className="mt-2 text-[10px] text-[#A43D34]">{error}</p>}</div>;
}
