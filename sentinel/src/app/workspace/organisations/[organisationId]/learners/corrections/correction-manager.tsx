'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Target = {
  learnerId: string; learnerReference: string; learnerStatus: string;
  firstName: string; middleName: string | null; lastName: string;
  preferredName: string | null; dateOfBirth: string | null;
};
type RequestRow = {
  id: string; learnerId: string; learnerReference: string; firstName: string; lastName: string;
  originalValues: Record<string, string | null>; proposedValues: Record<string, string | null>;
  reason: string; evidenceReference: string | null; status: string; requestedBy: string;
  requestedAt: string; reviewedBy: string | null; reviewedAt: string | null;
  reviewReason: string | null; appliedAt: string | null;
};
type HistoryRow = {
  id: string; learnerId: string; learnerReference: string; firstName: string; lastName: string;
  previousValues: Record<string, string | null>; correctedValues: Record<string, string | null>;
  changedFields: string[]; reason: string; evidenceReference: string | null;
  requestedBy: string; reviewedBy: string; appliedAt: string;
};
type FormState = { firstName: string; middleName: string; lastName: string; preferredName: string; dateOfBirth: string };

const labels: Record<string, string> = {
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name',
  preferredName: 'Preferred name', dateOfBirth: 'Date of birth',
};
const valueText = (value: string | null | undefined) => value === null || value === undefined || value === '' ? 'Not recorded' : value;
const formFor = (target?: Target): FormState => ({
  firstName: target?.firstName ?? '',
  middleName: target?.middleName ?? '',
  lastName: target?.lastName ?? '',
  preferredName: target?.preferredName ?? '',
  dateOfBirth: target?.dateOfBirth ?? '',
});

export function LearnerCorrectionManager({
  organisationId, actorUserId, initialTargets, initialRequests, initialHistory,
}: {
  organisationId: string; actorUserId: string; initialTargets: Target[];
  initialRequests: RequestRow[]; initialHistory: HistoryRow[];
}) {
  const router = useRouter();
  const [targets, setTargets] = useState(initialTargets);
  const [requests, setRequests] = useState(initialRequests);
  const [history, setHistory] = useState(initialHistory);
  const [selectedLearnerId, setSelectedLearnerId] = useState(initialTargets[0]?.learnerId ?? '');
  const [form, setForm] = useState<FormState>(() => formFor(initialTargets[0]));
  const [reason, setReason] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [reviewing, setReviewing] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setTargets(initialTargets);
    setRequests(initialRequests);
    setHistory(initialHistory);
  }, [initialTargets, initialRequests, initialHistory]);

  useEffect(() => {
    const selected = targets.find(item => item.learnerId === selectedLearnerId);
    if (selected) {
      setForm(formFor(selected));
    } else if (targets[0]) {
      setSelectedLearnerId(targets[0].learnerId);
      setForm(formFor(targets[0]));
    } else {
      setSelectedLearnerId('');
      setForm(formFor());
    }
  }, [targets, selectedLearnerId]);

  const selected = targets.find(item => item.learnerId === selectedLearnerId);
  const filteredTargets = targets.filter(item => {
    const query = search.trim().toLowerCase();
    return !query || [item.learnerReference, item.firstName, item.middleName ?? '', item.lastName].join(' ').toLowerCase().includes(query);
  });

  function chooseLearner(learnerId: string) {
    setSelectedLearnerId(learnerId);
    setForm(formFor(targets.find(item => item.learnerId === learnerId)));
    setError('');
    setNotice('');
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { setError('Select a learner record first.'); return; }
    const changes: Record<string, string | null> = {};
    if (form.firstName.trim() !== selected.firstName) changes.firstName = form.firstName;
    if ((form.middleName.trim() || '') !== (selected.middleName ?? '')) changes.middleName = form.middleName.trim() || null;
    if (form.lastName.trim() !== selected.lastName) changes.lastName = form.lastName;
    if ((form.preferredName.trim() || '') !== (selected.preferredName ?? '')) changes.preferredName = form.preferredName.trim() || null;
    if ((form.dateOfBirth || '') !== (selected.dateOfBirth ?? '')) changes.dateOfBirth = form.dateOfBirth || null;
    if (Object.keys(changes).length === 0) { setError('Change at least one identity field before submitting.'); return; }
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/learners/${selected.learnerId}/corrections`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...changes, reason, evidenceReference: evidenceReference || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit learner correction');
      setReason(''); setEvidenceReference('');
      setNotice('Correction submitted. The learner record remains unchanged until a different authorised administrator reviews it.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit learner correction');
    } finally { setPending(false); }
  }

  async function decide(requestId: string, decision: 'approve' | 'reject') {
    const reviewReason = (reviewReasons[requestId] ?? '').trim();
    if (reviewReason.length < 10) { setError('Provide a review reason of at least 10 characters.'); return; }
    if (decision === 'approve' && !window.confirm('Apply this correction to the canonical learner identity? The previous values will be preserved in correction history.')) return;
    setReviewing(requestId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/learner-corrections/${requestId}/review`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: reviewReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to review learner correction');
      setReviewReasons(current => ({ ...current, [requestId]: '' }));
      setNotice(result.status === 'conflicted'
        ? 'This request conflicted with a newer learner-record change. No correction was applied; submit a fresh request against the current record.'
        : result.status === 'applied'
          ? 'Correction approved and applied. Previous values are preserved in the audit history.'
          : 'Correction request rejected. The learner record was not changed.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to review learner correction');
    } finally { setReviewing(''); }
  }

  return <div className="mt-9 space-y-6">
    <section className="rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8">
      <p className="eyebrow">Governed identity changes</p>
      <h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Propose a learner-record correction</h2>
      <p className="mt-2 max-w-[900px] text-[12px] leading-6 text-[#718697]">
        Name and date-of-birth fields belong to the canonical person identity. An approved correction updates that identity wherever it is linked within this institution. Enrolment, grade, class, academic year, learner reference and status remain in their separate controlled workflows.
      </p>
      {targets.length ? <form onSubmit={submitCorrection} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-[#29465D]">Find learner
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or learner reference" className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/>
          </label>
          <label className="text-[11px] font-semibold text-[#29465D]">Learner record
            <select required value={selectedLearnerId} onChange={event => chooseLearner(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal">
              <option value="">Select a learner</option>
              {filteredTargets.map(item => <option key={item.learnerId} value={item.learnerId}>{item.learnerReference} · {item.firstName} {item.lastName} ({item.learnerStatus})</option>)}
            </select>
          </label>
        </div>
        {selected && <>
          <div className="rounded-xl bg-[#F5F9FA] px-4 py-3 text-[11px] text-[#60798B]">
            Current identity: <strong className="text-[#29465D]">{selected.firstName} {selected.middleName ?? ''} {selected.lastName}</strong>
            <span className="mx-2">·</span>{selected.learnerReference}
            <span className="mx-2">·</span>{selected.learnerStatus}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[11px] font-semibold text-[#29465D]">First name<input required maxLength={120} value={form.firstName} onChange={event => setForm(current => ({ ...current, firstName: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal"/></label>
            <label className="text-[11px] font-semibold text-[#29465D]">Middle name<input maxLength={120} value={form.middleName} onChange={event => setForm(current => ({ ...current, middleName: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal"/></label>
            <label className="text-[11px] font-semibold text-[#29465D]">Last name<input required maxLength={120} value={form.lastName} onChange={event => setForm(current => ({ ...current, lastName: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal"/></label>
            <label className="text-[11px] font-semibold text-[#29465D]">Preferred name<input maxLength={120} value={form.preferredName} onChange={event => setForm(current => ({ ...current, preferredName: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal"/></label>
            <label className="text-[11px] font-semibold text-[#29465D]">Date of birth<input type="date" value={form.dateOfBirth} onChange={event => setForm(current => ({ ...current, dateOfBirth: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal"/></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-[#29465D]">Correction reason *<textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why the current identity details are inaccurate." className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[12px] font-normal"/></label>
            <label className="text-[11px] font-semibold text-[#29465D]">Evidence reference (optional)<input maxLength={180} value={evidenceReference} onChange={event => setEvidenceReference(event.target.value)} placeholder="Register, document or case reference" className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal"/><span className="mt-2 block text-[10px] font-normal text-[#8A9CAB]">Record a reference only. Do not paste document contents or national identifiers.</span></label>
          </div>
          <button type="submit" disabled={pending} className="rounded-xl bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-60">{pending ? 'Submitting…' : 'Submit for independent review'}</button>
        </>}
      </form> : <p className="mt-5 rounded-xl bg-[#F5F9FA] p-5 text-[12px] text-[#718697]">No learner records are available in this institution yet.</p>}
    </section>

    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="border-b border-[#EAF0F4] px-6 py-5"><h2 className="text-[13px] font-semibold text-[#29465D]">Correction requests</h2><p className="mt-1 text-[10px] text-[#91A3B0]">A requester cannot approve or reject their own request.</p></div>
      {requests.length ? <div className="divide-y divide-[#EDF2F5]">{requests.map(request => <article key={request.id} className="space-y-3 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] font-semibold text-[#18364E]">{request.firstName} {request.lastName} · {request.learnerReference}</p><p className="mt-1 text-[10px] text-[#91A3B0]">Submitted {new Date(request.requestedAt).toLocaleString('en-KE')}</p></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#60798B]">{request.status}</span></div>
        <ul className="grid gap-2 sm:grid-cols-2">{Object.entries(request.proposedValues).map(([field, value]) => <li key={field} className="rounded-lg bg-[#F7FAFB] px-3 py-2 text-[11px] text-[#60798B]"><strong className="text-[#29465D]">{labels[field] ?? field}:</strong> {valueText(request.originalValues[field])} <span className="mx-1">→</span><strong className="text-[#087F86]">{valueText(value)}</strong></li>)}</ul>
        <p className="text-[11px] leading-5 text-[#718697]">Reason: {request.reason}{request.evidenceReference ? ` · Evidence ref: ${request.evidenceReference}` : ''}</p>
        {request.status === 'pending' && (request.requestedBy === actorUserId
          ? <p className="rounded-lg bg-[#F5F9FA] px-3 py-2 text-[11px] text-[#718697]">Awaiting an independent reviewer. You cannot review your own request.</p>
          : <div className="space-y-2"><label className="block text-[11px] font-semibold text-[#29465D]">Review reason<textarea minLength={10} maxLength={500} rows={2} value={reviewReasons[request.id] ?? ''} onChange={event => setReviewReasons(current => ({ ...current, [request.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[12px] font-normal"/></label><div className="flex flex-wrap gap-2"><button type="button" disabled={reviewing === request.id} onClick={() => decide(request.id, 'approve')} className="rounded-xl bg-[#087F86] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-60">{reviewing === request.id ? 'Saving…' : 'Approve and apply'}</button><button type="button" disabled={reviewing === request.id} onClick={() => decide(request.id, 'reject')} className="rounded-xl border border-[#DCE6EC] px-4 py-2.5 text-[10px] font-semibold text-[#536F82] disabled:opacity-60">Reject request</button></div></div>)}
        {request.reviewReason && <p className="text-[11px] text-[#718697]">Review note: {request.reviewReason}</p>}
      </article>)}</div> : <p className="px-6 py-8 text-[12px] text-[#91A3B0]">No correction requests have been submitted.</p>}
    </section>

    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="border-b border-[#EAF0F4] px-6 py-5"><h2 className="text-[13px] font-semibold text-[#29465D]">Applied correction history</h2><p className="mt-1 text-[10px] text-[#91A3B0]">Previous and corrected values are retained; this history cannot be edited or deleted.</p></div>
      {history.length ? <div className="divide-y divide-[#EDF2F5]">{history.map(entry => <article key={entry.id} className="space-y-2 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] font-semibold text-[#18364E]">{entry.firstName} {entry.lastName} · {entry.learnerReference}</p><span className="text-[10px] text-[#91A3B0]">Applied {new Date(entry.appliedAt).toLocaleString('en-KE')}</span></div>
        <ul className="grid gap-2 sm:grid-cols-2">{entry.changedFields.map(field => <li key={field} className="rounded-lg bg-[#F7FAFB] px-3 py-2 text-[11px] text-[#60798B]"><strong className="text-[#29465D]">{labels[field] ?? field}:</strong> {valueText(entry.previousValues[field])} <span className="mx-1">→</span><strong className="text-[#087F86]">{valueText(entry.correctedValues[field])}</strong></li>)}</ul>
        <p className="text-[11px] text-[#718697]">Reason: {entry.reason}{entry.evidenceReference ? ` · Evidence ref: ${entry.evidenceReference}` : ''}</p>
      </article>)}</div> : <p className="px-6 py-8 text-[12px] text-[#91A3B0]">No corrections have been applied.</p>}
    </section>

    {error && <p role="alert" className="rounded-xl border border-[#F2D9D4] bg-[#FFF8F6] px-4 py-3 text-[11px] text-[#9B4B3D]">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-[#DDEBEA] bg-[#F3FAF9] px-4 py-3 text-[11px] text-[#326D6C]">{notice}</p>}
  </div>;
}
