'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { organisationId: string; eventId: string; status: string; endsAt: string };

export function AssessmentEventControls({ organisationId, eventId, status, endsAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canClose = status === 'open' && new Date(endsAt).getTime() <= Date.now();
  const action = status === 'scheduled' ? 'open' : canClose ? 'close' : null;
  if (!action) return null;

  async function run() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/assessments/events/${eventId}/${action}`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to update event.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update event.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3"><button type="button" onClick={() => void run()} disabled={busy} className="rounded-full border border-[#CFE1E6] px-3 py-2 text-[10px] font-semibold text-[#087F86] hover:bg-[#F0FAF8] disabled:opacity-40">{busy ? 'Saving…' : action === 'open' ? 'Open event' : 'Close event'}</button>{error && <p role="alert" className="mt-2 text-[10px] text-[#A43D34]">{error}</p>}</div>;
}
