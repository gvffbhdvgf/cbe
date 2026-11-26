'use client';

import { useState } from 'react';

type LearnerOption = { id: string; learnerReference: string; firstName: string; lastName: string };
type Correction = { id: string; learnerId: string; fieldKey: string; originalValue: string | null; proposedValue: string | null; reason: string; evidenceReference: string | null; status: string; requestedBy: string; requestedAt: Date | string; reviewedBy: string | null; reviewedAt: Date | string | null; reviewReason: string | null };

const fields = [
  { value: 'legal_first_name', label: 'Legal first name' },
  { value: 'legal_middle_name', label: 'Legal middle name' },
  { value: 'legal_last_name', label: 'Legal last name' },
  { value: 'preferred_name', label: 'Preferred name' },
  { value: 'date_of_birth', label: 'Date of birth' },
];

export function LearnerCorrectionManager({ organisationId, actorUserId, learners, initialRequests }: { organisationId: string; actorUserId: string; learners: LearnerOption[]; initialRequests: Correction[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [learnerId, setLearnerId] = useState(learners[0]?.id ?? '');
  const [fieldKey, setFieldKey] = useState('legal_first_name');
  const [proposedValue, setProposedValue] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reviewReasons, setReviewReasons] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const response = await fetch(`/api/organisations/${organisationId}/learner-corrections`);
    const payload = await response.json();
    if (response.ok) setRequests(payload.requests);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('submit'); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/learner-corrections`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ learnerId, fieldKey, proposedValue: proposedValue || null, reason, evidenceReference: evidenceReference || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to submit correction request');
      setProposedValue(''); setReason(''); setEvidenceReference('');
      await refresh(); setNotice('Correction request submitted. The current learner record remains unchanged until an independent administrator approves it.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit correction request'); }
    finally { setBusy(''); }
  }

  async function review(request: Correction, decision: 'approved'|'rejected') {
    const reviewReason = reviewReasons[request.id] || '';
    if (request.requestedBy === actorUserId) { setError('You cannot review a correction request you submitted.'); return; }
    if (reviewReason.trim().length < 3) { setError('A review reason of at least 3 characters is required.'); return; }
    setBusy(request.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/learner-corrections/${request.id}/review`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reviewReason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to review correction request');
      await refresh(); setNotice(`Correction request ${decision}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to review correction request'); }
    finally { setBusy(''); }
  }

  const display = (value: string | null) => value === null ? '— (empty)' : value;
  return <section className="mt-7 rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8">
    <p className="eyebrow">Data governance</p>
    <h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Learner identity corrections</h2>
    <p className="mt-2 max-w-[760px] text-[12px] leading-6 text-[#718697]">Correct legal names, preferred names and date of birth through a two-person review. The request records the existing and proposed values; only a different authorised administrator can approve it. Enrolment, class placement and assessment history are not altered.</p>
    <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-[11px] font-semibold text-[#29465D]">Learner<select required value={learnerId} onChange={e=>setLearnerId(e.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[12px]">{learners.map(item=><option key={item.id} value={item.id}>{item.learnerReference} · {item.firstName} {item.lastName}</option>)}</select></label>
      <label className="text-[11px] font-semibold text-[#29465D]">Field to correct<select value={fieldKey} onChange={e=>setFieldKey(e.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[12px]">{fields.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="text-[11px] font-semibold text-[#29465D]">Proposed value<input type={fieldKey==='date_of_birth'?'date':'text'} maxLength={120} value={proposedValue} onChange={e=>setProposedValue(e.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[12px]" placeholder="Enter corrected value; leave blank only to clear an optional field"/></label>
      <label className="text-[11px] font-semibold text-[#29465D]">Evidence reference (optional)<input maxLength={180} value={evidenceReference} onChange={e=>setEvidenceReference(e.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[12px]" placeholder="Register, certificate or document reference"/></label>
      <label className="text-[11px] font-semibold text-[#29465D] sm:col-span-2">Reason for correction<textarea required minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[12px]" placeholder="Explain why the existing learner detail is inaccurate"/></label>
      <div className="sm:col-span-2"><button disabled={busy==='submit'||!learnerId} className="rounded-xl bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-50">{busy==='submit'?'Submitting…':'Submit correction request'}</button></div>
    </form>
    {error && <p role="alert" className="mt-3 text-[11px] text-[#A43D34]">{error}</p>}
    {notice && <p role="status" className="mt-3 text-[11px] text-[#176E66]">{notice}</p>}
    <div className="mt-7 border-t border-[#EAF0F4] pt-5"><h3 className="text-[13px] font-semibold text-[#18364E]">Correction history</h3>
      {requests.length===0 ? <p className="mt-3 text-[11px] text-[#718697]">No correction requests have been submitted.</p> : <div className="mt-3 space-y-3">{requests.map(request=>{
        const learner=learners.find(item=>item.id===request.learnerId);
        return <article key={request.id} className="rounded-xl border border-[#E1EAF0] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-semibold text-[#18364E]">{learner?.learnerReference ?? 'Learner'} · {fields.find(item=>item.value===request.fieldKey)?.label}</p><span className="rounded-full bg-[#F1F5F7] px-3 py-1 text-[10px] text-[#526B7E]">{request.status}</span></div>
          <p className="mt-2 text-[11px] text-[#526B7E]">From: <strong>{display(request.originalValue)}</strong> → Proposed: <strong>{display(request.proposedValue)}</strong></p>
          <p className="mt-1 text-[11px] text-[#718697]">Reason: {request.reason}{request.evidenceReference? ` · Evidence: ${request.evidenceReference}`:''}</p>
          {request.status==='pending' && <div className="mt-3 border-t border-[#EAF0F4] pt-3"><textarea value={reviewReasons[request.id]||''} onChange={e=>setReviewReasons(old=>({...old,[request.id]:e.target.value}))} rows={2} maxLength={500} className="w-full rounded-lg border border-[#DCE6EC] px-3 py-2 text-[11px]" placeholder="Independent review reason (required)"/><div className="mt-2 flex gap-2"><button type="button" disabled={busy===request.id||request.requestedBy===actorUserId} onClick={()=>void review(request,'approved')} className="rounded-full bg-[#102B45] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Approve correction</button><button type="button" disabled={busy===request.id||request.requestedBy===actorUserId} onClick={()=>void review(request,'rejected')} className="rounded-full border border-[#DCE6EC] px-4 py-2 text-[10px] font-semibold text-[#526B7E] disabled:opacity-40">Reject request</button></div>{request.requestedBy===actorUserId&&<p className="mt-2 text-[10px] text-[#A43D34]">You submitted this request; another administrator must review it.</p>}</div>}
          {request.reviewReason&&<p className="mt-2 text-[10px] text-[#718697]">Review: {request.reviewReason}</p>}
        </article>;
      })}</div>}
    </div>
  </section>;
}
