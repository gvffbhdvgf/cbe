'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Enrolment = {
  enrolmentId: string; learnerId: string; learnerReference: string; firstName: string; lastName: string;
  preferredName: string | null; grade: number; academicYear: number; startsAt: string; endsAt: string | null;
};
type Outgoing = {
  id: string; transferReference: string; receivingOrganisationId: string; receivingOrganisationName: string;
  sourceGrade: number; destinationGrade: number; destinationAcademicYear: number; effectiveAt: string;
  reasonCode: string; status: string; requestedAt: string; learnerId: string; sourceEnrolmentId: string;
  learnerReference: string; firstName: string; lastName: string; preferredName: string | null;
};
type Incoming = {
  id: string; transferReference: string; sendingOrganisationName: string; sourceGrade: number;
  destinationGrade: number; destinationAcademicYear: number; effectiveAt: string; reasonCode: string;
  status: string; rejectionCode: string | null; requestedAt: string;
};
type Summary = {
  organisation: { id: string; name: string; timeZone: string };
  activeEnrolments: Enrolment[];
  otherOrganisations: { id: string; name: string }[];
  outgoing: Outgoing[];
  incoming: Incoming[];
};

const field = 'mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label = 'block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';
const todayInKenya = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const titleCase = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const nameOf = (row: Enrolment | Outgoing) => [row.preferredName || row.firstName, row.lastName].filter(Boolean).join(' ');

export function LearnerTransferManager({ organisationId, initialSummary }: { organisationId: string; initialSummary: Summary }) {
  const router=useRouter();
  const [summary,setSummary]=useState(initialSummary);
  const [sourceEnrolmentId,setSourceEnrolmentId]=useState('');
  const [receivingOrganisationId,setReceivingOrganisationId]=useState('');
  const [destinationGrade,setDestinationGrade]=useState('1');
  const [destinationAcademicYear,setDestinationAcademicYear]=useState(String(new Date().getFullYear()+1));
  const [effectiveAt,setEffectiveAt]=useState(todayInKenya());
  const [reasonCode,setReasonCode]=useState('family_relocation');
  const [rejectionCodes,setRejectionCodes]=useState<Record<string,string>>({});
  const [destinationSelections,setDestinationSelections]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function reload() {
    const response=await fetch('/api/organisations/'+organisationId+'/transfers');
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||'Unable to refresh learner transfers.');
    setSummary(payload as Summary);
  }
  async function act(key:string,body:Record<string,unknown>,success:string) {
    setBusy(key);setError('');setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/transfers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'The transfer action could not be completed.');
      await reload();setMessage(success);router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'The transfer action could not be completed.'); }
    finally { setBusy(''); }
  }
  async function request(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act('request',{action:'request',sourceEnrolmentId,receivingOrganisationId,destinationGrade:Number(destinationGrade),destinationAcademicYear:Number(destinationAcademicYear),effectiveAt,reasonCode},'Transfer request sent. The receiving institution sees a reference and grade-level details, not the learner identity.');
    setSourceEnrolmentId('');setReceivingOrganisationId('');setDestinationGrade('1');setEffectiveAt(todayInKenya());
  }
  const eligibleDestination=(transfer:Incoming)=>summary.activeEnrolments.filter(e=>
    e.grade===transfer.destinationGrade && e.academicYear===transfer.destinationAcademicYear && e.startsAt===transfer.effectiveAt && !e.endsAt
  );
  return <div className="mt-8 space-y-6">
    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <p className="eyebrow">Learner mobility</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Request a learner transfer</h2>
      <p className="mt-2 max-w-[820px] text-[11px] leading-6 text-[#718697]">The sending institution initiates the request. The receiving institution must accept before the sending institution releases the learner. Only after release does the receiving institution link the transfer to a locally verified learner record.</p>
      <form onSubmit={request} className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={label}>Active source learner enrolment</label><select required value={sourceEnrolmentId} onChange={e=>{setSourceEnrolmentId(e.target.value);const selected=summary.activeEnrolments.find(x=>x.enrolmentId===e.target.value);if(selected)setDestinationGrade(String(selected.grade));}} className={field}><option value="">Choose learner and current enrolment</option>{summary.activeEnrolments.map(e=><option key={e.enrolmentId} value={e.enrolmentId}>{e.learnerReference} · {nameOf(e)} · Grade {e.grade} ({e.academicYear})</option>)}</select></div>
        <div><label className={label}>Receiving institution</label><select required value={receivingOrganisationId} onChange={e=>setReceivingOrganisationId(e.target.value)} className={field}><option value="">Choose receiving institution</option>{summary.otherOrganisations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div><label className={label}>Reason</label><select value={reasonCode} onChange={e=>setReasonCode(e.target.value)} className={field}><option value="family_relocation">Family relocation</option><option value="school_change">School change</option><option value="placement_change">Placement change</option><option value="other">Other</option></select></div>
        <div><label className={label}>Destination grade</label><select value={destinationGrade} onChange={e=>setDestinationGrade(e.target.value)} className={field}>{Array.from({length:9},(_,i)=>i+1).map(n=><option key={n} value={n}>Grade {n}</option>)}</select></div>
        <div><label className={label}>Destination academic year</label><input type="number" min="2000" max="2100" value={destinationAcademicYear} onChange={e=>setDestinationAcademicYear(e.target.value)} className={field}/></div>
        <div><label className={label}>Transfer effective date</label><input type="date" min={todayInKenya()} value={effectiveAt} onChange={e=>setEffectiveAt(e.target.value)} className={field}/></div>
        <div className="flex items-end"><button disabled={busy!==''||!sourceEnrolmentId||!receivingOrganisationId} className="rounded-full bg-[#087F86] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40">{busy==='request'?'Sending…':'Send transfer request'}</button></div>
      </form>
    </section>

    {error&&<div role="alert" className="rounded-xl border border-[#F1D2CC] bg-[#FFF7F5] px-4 py-3 text-[11px] text-[#9A4B3D]">{error}</div>}
    {message&&<div role="status" className="rounded-xl border border-[#CFE8E2] bg-[#F1FAF7] px-4 py-3 text-[11px] text-[#28675D]">{message}</div>}

    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Sending institution</p><h2 className="mt-2 text-[20px] font-semibold text-[#102B45]">Outgoing transfers</h2></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{summary.outgoing.length} requests</span></div>
      {summary.outgoing.length===0?<p className="mt-5 rounded-xl bg-[#FBFDFD] p-5 text-[11px] text-[#8296A5]">No outgoing transfer requests.</p>:<div className="mt-5 space-y-3">{summary.outgoing.map(t=><article key={t.id} className="rounded-xl border border-[#E5EDF1] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[12px] font-semibold text-[#29465D]">{t.transferReference} · {nameOf(t)}</p><p className="mt-1 text-[10px] text-[#8296A5]">{t.learnerReference} · Grade {t.sourceGrade} → Grade {t.destinationGrade} ({t.destinationAcademicYear}) · {t.receivingOrganisationName}</p></div><span className="rounded-full bg-[#F3F7F9] px-2.5 py-1 text-[9px] font-semibold text-[#718697]">{titleCase(t.status)}</span></div>
        <p className="mt-2 text-[10px] text-[#8296A5]">{titleCase(t.reasonCode)} · Effective {t.effectiveAt}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(t.status==='requested'||t.status==='accepted')&&<button disabled={busy!==''} onClick={()=>void act('cancel:'+t.id,{action:'cancel',transferId:t.id},'Transfer request cancelled before release.')} className="rounded-full border border-[#E4C8C1] px-3 py-2 text-[10px] font-semibold text-[#9A4B3D] disabled:opacity-40">Cancel request</button>}
          {t.status==='accepted'&&t.effectiveAt<=todayInKenya()&&<button disabled={busy!==''} onClick={()=>void act('release:'+t.id,{action:'release',transferId:t.id},'Learner released from the sending institution.')} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Release learner</button>}
        </div>
      </article>)}</div>}
    </section>

    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Receiving institution</p><h2 className="mt-2 text-[20px] font-semibold text-[#102B45]">Incoming transfer requests</h2></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{summary.incoming.length} requests</span></div>
      <p className="mt-2 text-[10px] leading-5 text-[#8296A5]">Incoming requests intentionally exclude the source learner&apos;s name, reference and identity. The sending institution retains that link; your institution links a released request to a local learner record after its own checks.</p>
      {summary.incoming.length===0?<p className="mt-5 rounded-xl bg-[#FBFDFD] p-5 text-[11px] text-[#8296A5]">No incoming transfer requests.</p>:<div className="mt-5 space-y-3">{summary.incoming.map(t=><article key={t.id} className="rounded-xl border border-[#E5EDF1] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[12px] font-semibold text-[#29465D]">{t.transferReference} · {t.sendingOrganisationName}</p><p className="mt-1 text-[10px] text-[#8296A5]">Grade {t.sourceGrade} → Grade {t.destinationGrade} ({t.destinationAcademicYear}) · {titleCase(t.reasonCode)}</p></div><span className="rounded-full bg-[#F3F7F9] px-2.5 py-1 text-[9px] font-semibold text-[#718697]">{titleCase(t.status)}</span></div>
        <p className="mt-2 text-[10px] text-[#8296A5]">Effective {t.effectiveAt}{t.rejectionCode?' · '+titleCase(t.rejectionCode):''}</p>
        {t.status==='requested'&&<div className="mt-3 flex flex-wrap items-center gap-2"><button disabled={busy!==''} onClick={()=>void act('accept:'+t.id,{action:'accept',transferId:t.id},'Transfer accepted. The sending institution can now release the learner.')} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Accept request</button><select value={rejectionCodes[t.id]||'not_eligible'} onChange={e=>setRejectionCodes(s=>({...s,[t.id]:e.target.value}))} className={field+' max-w-[220px]'}><option value="not_eligible">Not eligible</option><option value="missing_documentation">Missing documentation</option><option value="capacity_unavailable">Capacity unavailable</option><option value="other">Other</option></select><button disabled={busy!==''} onClick={()=>void act('reject:'+t.id,{action:'reject',transferId:t.id,rejectionCode:rejectionCodes[t.id]||'not_eligible'},'Transfer request rejected with a recorded reason code.')} className="rounded-full border border-[#E4C8C1] px-3 py-2 text-[10px] font-semibold text-[#9A4B3D] disabled:opacity-40">Reject</button></div>}
        {t.status==='released'&&<div className="mt-3 rounded-xl bg-[#FBFDFD] p-3"><p className="text-[10px] leading-5 text-[#718697]">The sending institution has released this transfer. Select a local active learner enrolment matching the approved destination grade, year and effective date to complete the link.</p>{eligibleDestination(t).length?<div className="mt-2 flex flex-wrap gap-2"><select value={destinationSelections[t.id]||''} onChange={e=>setDestinationSelections(s=>({...s,[t.id]:e.target.value}))} className={field+' min-w-[260px] flex-1'}><option value="">Choose local learner and enrolment</option>{eligibleDestination(t).map(e=><option key={e.enrolmentId} value={e.learnerId+'|'+e.enrolmentId}>{e.learnerReference} · {nameOf(e)}</option>)}</select><button disabled={busy!==''||!destinationSelections[t.id]} onClick={()=>{const [learnerId,enrolmentId]=destinationSelections[t.id].split('|');void act('complete:'+t.id,{action:'complete',transferId:t.id,learnerId,enrolmentId},'Transfer completed and linked to the local learner record.');}} className="rounded-full bg-[#087F86] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Complete transfer</button></div>:<p className="mt-2 text-[10px] text-[#9A6B35]">No matching local enrolment exists yet. Create the learner and active enrolment in the learner register with the approved grade, year and effective date, then return here.</p>}</div>}
      </article>)}</div>}
    </section>
  </div>;
}
