'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Learner = { academicYear:number };
type ClassOption = { id:string; classCode:string; displayName:string; grade:number; academicYear:number; status:string };
type Batch = { id:string; from_academic_year:number; to_academic_year:number; effective_at:string; status:string; learner_count:number; unresolved_count:number; planned_count:number; submitted_count:number; excluded_count:number; approved_count:number; executed_count:number; rejected_count:number };
type Item = { id:string; batch_id:string; learner_id:string; learner_reference:string; source_enrolment_id:string; from_grade:number; outcome:string; to_grade:number|null; target_class_id:string|null; reason:string|null; status:string; progression_request_id:string|null; progression_status:string|null; target_class_code:string|null };
type Draft = { outcome:string; targetClassId:string; reason:string };

const field='mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label='block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';

export function AcademicYearRolloverManager({organisationId,learners,classes,initialBatches,initialItems}:{organisationId:string;learners:Learner[];classes:ClassOption[];initialBatches:Batch[];initialItems:Item[]}) {
 const router=useRouter();
 const [batches,setBatches]=useState(initialBatches);
 const [items,setItems]=useState(initialItems);
 const years=useMemo(()=>Array.from(new Set(learners.map(item=>item.academicYear))).sort((a,b)=>b-a),[learners]);
 const [fromYear,setFromYear]=useState(years[0]??new Date().getFullYear());
 const [effectiveAt,setEffectiveAt]=useState('');
 const [drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 async function refresh() {
  const response=await fetch(`/api/organisations/${organisationId}/academic-year-rollovers`);
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error||'Unable to refresh rollover plans');
  setBatches(payload.batches);setItems(payload.items);
 }

 async function create(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy('create');setError('');setNotice('');
  try {
   const response=await fetch(`/api/organisations/${organisationId}/academic-year-rollovers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fromAcademicYear:fromYear,effectiveAt})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to create rollover plan');
   await refresh();setEffectiveAt('');setNotice(`Draft cohort snapshot created for ${fromYear} → ${fromYear+1}. No learner enrolments have changed.`);
  } catch(cause){setError(cause instanceof Error?cause.message:'Unable to create rollover plan');}
  finally{setBusy('');}
 }

 async function saveDecision(batch:Batch,item:Item) {
  const draft=drafts[item.id]??{outcome:item.outcome,targetClassId:item.target_class_id??'',reason:item.reason??''};
  setBusy(item.id);setError('');setNotice('');
  try {
   const response=await fetch(`/api/organisations/${organisationId}/academic-year-rollovers/${batch.id}/items/${item.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({outcome:draft.outcome,targetClassId:draft.outcome==='not_progressing'?null:(draft.targetClassId||null),reason:draft.reason})});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to save learner decision');
   await refresh();setNotice(`Saved disposition for ${item.learner_reference}.`);
  } catch(cause){setError(cause instanceof Error?cause.message:'Unable to save learner decision');}
  finally{setBusy('');}
 }

 async function submit(batch:Batch) {
  if(!window.confirm(`Submit the complete ${batch.from_academic_year} → ${batch.to_academic_year} cohort plan? Promotion/repetition decisions will create individual progression requests for independent approval. No enrolment will change at submission.`))return;
  setBusy(batch.id);setError('');setNotice('');
  try {
   const response=await fetch(`/api/organisations/${organisationId}/academic-year-rollovers/${batch.id}/submit`,{method:'POST'});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to submit rollover plan');
   await refresh();router.refresh();setNotice(`Rollover submitted. ${payload.progressionRequestsCreated} individual progression request(s) were created for independent review.`);
  } catch(cause){setError(cause instanceof Error?cause.message:'Unable to submit rollover plan');}
  finally{setBusy('');}
 }

 function draftFor(item:Item):Draft {
  return drafts[item.id]??{outcome:item.outcome,targetClassId:item.target_class_id??'',reason:item.reason??''};
 }

 return <section className="mt-7 rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8">
  <p className="eyebrow">Cohort planning</p>
  <h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Academic-year rollover</h2>
  <p className="mt-2 max-w-[820px] text-[12px] leading-6 text-[#718697]">Prepare a complete source-year cohort, record a reasoned outcome for every active learner, then submit individual progression requests for independent approval. This does not automatically promote learners, withdraw or transfer anyone, or change enrolments.</p>
  {years.length===0?<p className="mt-4 rounded-xl bg-[#F8FBFC] p-4 text-[11px] text-[#718697]">There are no active learner enrolments available for rollover planning.</p>:<form onSubmit={create} className="mt-5 grid gap-3 rounded-xl border border-[#E5EDF1] bg-[#FBFDFD] p-4 sm:grid-cols-3">
   <label className={label}>Source academic year<select value={fromYear} onChange={e=>setFromYear(Number(e.target.value))} className={field}>{years.map(year=><option key={year} value={year}>{year} → {year+1}</option>)}</select></label>
   <label className={label}>Rollover effective date<input required type="date" value={effectiveAt} onChange={e=>setEffectiveAt(e.target.value)} className={field}/></label>
   <div className="flex items-end"><button disabled={busy==='create'} className="w-full rounded-xl bg-[#102B45] px-4 py-3 text-[11px] font-semibold text-white disabled:opacity-50">{busy==='create'?'Creating…':'Create cohort snapshot'}</button></div>
  </form>}
  {error&&<p role="alert" className="mt-3 text-[11px] text-[#A43D34]">{error}</p>}{notice&&<p role="status" className="mt-3 text-[11px] text-[#176E66]">{notice}</p>}
  <div className="mt-6 space-y-4">
   {batches.length===0?<p className="rounded-xl border border-dashed border-[#DCE7EC] p-5 text-[11px] text-[#718697]">No rollover plans have been created.</p>:batches.map(batch=>{
    const cohort=items.filter(item=>item.batch_id===batch.id);
    return <article key={batch.id} className="rounded-2xl border border-[#E1EAF0] p-4 sm:p-5">
     <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-[13px] font-semibold text-[#18364E]">{batch.from_academic_year} → {batch.to_academic_year}</h3><p className="mt-1 text-[10px] text-[#718697]">Effective {String(batch.effective_at).slice(0,10)} · {batch.learner_count} learners · {batch.status}</p></div><span className="rounded-full bg-[#F1F5F7] px-3 py-1 text-[10px] text-[#526B7E]">{batch.unresolved_count} unresolved</span></div>
     <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#718697]"><span>{batch.planned_count} decisions</span><span>{batch.submitted_count} requests</span><span>{batch.excluded_count} not progressing</span><span>{batch.approved_count} approved</span><span>{batch.executed_count} executed</span><span>{batch.rejected_count} rejected</span></div>
     <div className="mt-4 divide-y divide-[#EAF0F4]">
      {cohort.map(item=>{
       const draft=draftFor(item);
       const targetGrade=draft.outcome==='promote'?item.from_grade+1:item.from_grade;
       const targetClasses=classes.filter(option=>option.academicYear===batch.to_academic_year&&option.grade===targetGrade&&option.status==='active');
       return <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto] sm:items-end">
        <div><p className="text-[11px] font-semibold text-[#29465D]">{item.learner_reference}</p><p className="mt-1 text-[10px] text-[#8498A7]">Current grade {item.from_grade}</p></div>
        {batch.status==='draft'?<>
         <label className={label}>Outcome<select value={draft.outcome} onChange={e=>setDrafts(old=>({...old,[item.id]:{...draft,outcome:e.target.value,targetClassId:''}}))} className={field}><option value="unresolved">Choose outcome</option><option value="promote" disabled={item.from_grade===9}>Promote to grade {item.from_grade+1}</option><option value="repeat">Repeat grade {item.from_grade}</option><option value="not_progressing">Not progressing</option></select></label>
         <label className={label}>Target class<select disabled={draft.outcome==='not_progressing'||draft.outcome==='unresolved'} value={draft.targetClassId} onChange={e=>setDrafts(old=>({...old,[item.id]:{...draft,targetClassId:e.target.value}}))} className={field}><option value="">Unplaced</option>{targetClasses.map(option=><option key={option.id} value={option.id}>{option.classCode} · {option.displayName}</option>)}</select></label>
         <label className={label}>Reason<textarea value={draft.reason} onChange={e=>setDrafts(old=>({...old,[item.id]:{...draft,reason:e.target.value}}))} minLength={10} maxLength={500} rows={2} className={field} placeholder="Explain the learner-specific decision"/></label>
         <button type="button" disabled={busy===item.id||draft.outcome==='unresolved'||draft.reason.trim().length<10} onClick={()=>void saveDecision(batch,item)} className="rounded-lg border border-[#DCE7EC] px-3 py-2.5 text-[10px] font-semibold text-[#29465D] disabled:opacity-40">{busy===item.id?'Saving…':'Save'}</button>
        </>:<div className="sm:col-span-4"><p className="text-[11px] text-[#526B7E]">{item.outcome==='not_progressing'?'Not progressing':item.outcome==='promote'?'Promote':'Repeat'}{item.to_grade? ` · Grade ${item.to_grade}`:''} · {item.target_class_code??'Unplaced'}</p><p className="mt-1 text-[10px] text-[#8498A7]">{item.reason??''} {item.progression_status? `· Progression: ${item.progression_status}`:''}</p></div>}
       </div>;
      })}
     </div>
     {batch.status==='draft'&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAF0F4] pt-4"><p className="text-[10px] text-[#8498A7]">Every active learner must have a saved decision before submission. Promotion and repetition still require independent approval.</p><button type="button" disabled={busy===batch.id||batch.unresolved_count>0||batch.planned_count+batch.excluded_count!==batch.learner_count} onClick={()=>void submit(batch)} className="rounded-xl bg-[#102B45] px-4 py-3 text-[10px] font-semibold text-white disabled:opacity-40">{busy===batch.id?'Submitting…':'Submit rollover plan'}</button></div>}
    </article>;
   })}
  </div>
 </section>;
}
