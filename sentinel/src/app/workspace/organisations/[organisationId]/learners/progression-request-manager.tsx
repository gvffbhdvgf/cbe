'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Learner = { enrolmentId:string; learnerId:string; learnerReference:string; grade:number; academicYear:number; classId:string|null };
type ClassOption = { id:string; classCode:string; displayName:string; grade:number; academicYear:number };
type ProgressionRequest = { id:string; enrolment_id:string; learner_id:string; learner_reference:string; from_grade:number; from_academic_year:number; to_grade:number; to_academic_year:number; target_class_id:string|null; target_class_code:string|null; effective_at:string; reason:string; status:string; requested_by:string; decided_by:string|null; decision_note:string|null; new_enrolment_id:string|null };
type Props = { organisationId:string; actorUserId:string; learners:Learner[]; classes:ClassOption[]; requests:ProgressionRequest[] };
const field='mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label='block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';

export function ProgressionRequestManager({organisationId,actorUserId,learners,classes,requests}:Props) {
 const router=useRouter();
 const [enrolmentId,setEnrolmentId]=useState(learners[0]?.enrolmentId??'');
 const selected=learners.find(item=>item.enrolmentId===enrolmentId);
 const [toGrade,setToGrade]=useState(selected?Math.min(9,selected.grade+1):1);
 const toYear=(selected?.academicYear??new Date().getFullYear())+1;
 const [targetClassId,setTargetClassId]=useState('');
 const [effectiveAt,setEffectiveAt]=useState('');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const targetClasses=useMemo(()=>classes.filter(item=>item.grade===toGrade&&item.academicYear===toYear),[classes,toGrade,toYear]);

 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault(); if(!selected)return; setBusy('request');setError('');setNotice('');
  try {
   const response=await fetch(`/api/organisations/${organisationId}/enrolments/${enrolmentId}/progression`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({toGrade,toAcademicYear:toYear,targetClassId:targetClassId||null,effectiveAt,reason})});
   const result=await response.json(); if(!response.ok)throw new Error(result.error||'Unable to request progression');
   setNotice('Progression request recorded. A different authorised administrator must approve it before it can be executed.');
   setReason('');setTargetClassId('');setEffectiveAt('');router.refresh();
  } catch(cause){setError(cause instanceof Error?cause.message:'Unable to request progression');}
  finally{setBusy('');}
 }

 async function decide(requestId:string,action:'approve'|'reject') {
  let body:Record<string,string>={};
  if(action==='approve') { if(!window.confirm('Approve this progression request? The requester cannot approve their own request.'))return; }
  else { const reason=window.prompt('Provide a reason for rejecting this progression request (10–500 characters):'); if(!reason||reason.trim().length<10)return; body={reason}; }
  setBusy(requestId);setError('');setNotice('');
  try {
   const response=await fetch(`/api/organisations/${organisationId}/progression-requests/${requestId}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to record progression decision');
   setNotice(action==='approve'?'Progression approved. It can be executed on or after its effective date.':'Progression request rejected.');
   router.refresh();
  } catch(cause){setError(cause instanceof Error?cause.message:'Unable to record progression decision');}
  finally{setBusy('');}
 }

 async function execute(requestId:string) {
  if(!window.confirm('Execute this approved progression? This will end the current enrolment and create the next academic-year enrolment.'))return;
  setBusy(requestId);setError('');setNotice('');
  try {
   const response=await fetch(`/api/organisations/${organisationId}/progression-requests/${requestId}/execute`,{method:'POST'});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to execute progression');
   setNotice('Progression executed and the new enrolment was created.');
   router.refresh();
  } catch(cause){setError(cause instanceof Error?cause.message:'Unable to execute progression');}
  finally{setBusy('');}
 }

 const today=new Date().toISOString().slice(0,10);
 return <div className="mt-8 space-y-6">
  <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
   <p className="eyebrow">Academic-year planning</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Request learner progression</h2>
   <p className="mt-2 text-[11px] leading-6 text-[#718697]">Plan promotion or repetition into the next academic year. Requests do not change enrolments until a different authorised administrator approves them and the effective date arrives.</p>
   {learners.length===0?<p className="mt-5 rounded-xl bg-[#F8FBFC] p-4 text-[11px] text-[#718697]">There are no active enrolments to progress.</p>:
   <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4 sm:grid-cols-2">
    <label className={label}>Active learner<select required value={enrolmentId} onChange={e=>{const learner=learners.find(item=>item.enrolmentId===e.target.value);setEnrolmentId(e.target.value);setToGrade(learner?Math.min(9,learner.grade+1):1);setTargetClassId('');}} className={field}>{learners.map(item=><option key={item.enrolmentId} value={item.enrolmentId}>{item.learnerReference} · Grade {item.grade} · {item.academicYear}</option>)}</select></label>
    <label className={label}>Target grade<select required value={toGrade} onChange={e=>{setToGrade(Number(e.target.value));setTargetClassId('');}} className={field}>{selected&&[selected.grade,Math.min(9,selected.grade+1)].filter((v,i,a)=>a.indexOf(v)===i).map(value=><option key={value} value={value}>{value===selected.grade?'Repeat':'Promote'} · Grade {value}</option>)}</select></label>
    <label className={label}>Target academic year<input readOnly value={toYear} className={field+' bg-[#F1F6F8]'}/></label>
    <label className={label}>Target class (optional)<select value={targetClassId} onChange={e=>setTargetClassId(e.target.value)} className={field}><option value="">Unplaced until class assignment</option>{targetClasses.map(item=><option key={item.id} value={item.id}>{item.classCode} · {item.displayName}</option>)}</select></label>
    <label className={label}>Effective date<input type="date" required min={selected?.academicYear?String(selected.academicYear+1)+'-01-01':undefined} value={effectiveAt} onChange={e=>setEffectiveAt(e.target.value)} className={field}/></label>
    <label className={label+' sm:col-span-2'}>Reason<textarea required minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Record the educational basis for this promotion or repetition decision." className={field+' min-h-[82px]'}/></label>
    <div className="sm:col-span-2"><button disabled={busy!==''} className="rounded-full bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40">{busy==='request'?'Submitting…':'Submit progression request'}</button></div>
   </form>}
   {error&&<p role="alert" className="mt-4 text-[11px] text-[#A43D34]">{error}</p>}{notice&&<p role="status" className="mt-4 text-[11px] text-[#087F86]">{notice}</p>}
  </section>
  <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
   <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">Progression approvals register</h2><p className="mt-1 text-[11px] text-[#8498A7]">Independent approval, effective-date execution and decision history.</p></div>
   {requests.length===0?<p className="px-5 py-9 text-[12px] text-[#8498A7]">No progression requests have been recorded.</p>:<div className="divide-y divide-[#E8EEF2]">{requests.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-[240px]"><p className="text-[12px] font-semibold text-[#29465D]">{item.learner_reference} · Grade {item.from_grade} ({item.from_academic_year}) → Grade {item.to_grade} ({item.to_academic_year})</p><p className="mt-1 text-[11px] text-[#718697]">{item.target_class_code??'No class selected'} · Effective {item.effective_at} · {item.status}</p><p className="mt-1 max-w-[680px] text-[10px] leading-5 text-[#8A9CAB]">{item.reason}</p>{item.decision_note&&<p className="mt-1 text-[10px] text-[#8A9CAB]">Decision: {item.decision_note}</p>}</div>
    <div className="flex flex-wrap items-center gap-2">{item.status==='pending'&&item.requested_by!==actorUserId&&<><button type="button" disabled={busy!==''} onClick={()=>void decide(item.id,'approve')} className="rounded-full bg-[#102B45] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40">{busy===item.id?'Saving…':'Approve'}</button><button type="button" disabled={busy!==''} onClick={()=>void decide(item.id,'reject')} className="rounded-full border border-[#E7D4D0] px-3 py-2 text-[10px] font-semibold text-[#A43D34] disabled:opacity-40">Reject</button></>}
    {item.status==='pending'&&item.requested_by===actorUserId&&<span className="text-[10px] text-[#8A9CAB]">Awaiting another administrator</span>}
    {item.status==='approved'&&item.effective_at<=today&&<button type="button" disabled={busy!==''} onClick={()=>void execute(item.id)} className="rounded-full bg-[#087F86] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40">{busy===item.id?'Executing…':'Execute progression'}</button>}
    {item.status==='approved'&&item.effective_at>today&&<span className="text-[10px] text-[#8A9CAB]">Scheduled for {item.effective_at}</span>}
    {item.status==='executed'&&<span className="text-[10px] font-semibold text-[#087F86]">New enrolment created</span>}
    </div></div>)}</div>}
  </section>
 </div>;
}
