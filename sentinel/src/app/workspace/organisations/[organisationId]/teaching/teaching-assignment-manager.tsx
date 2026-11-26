'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Teacher = { userId: string; name: string; email: string; staffReference: string };
type ClassOption = { id: string; classCode: string; displayName: string; grade: number; academicYear: number };
type LearningArea = { id: string; name: string };
type WorkloadPolicy = { id: string; academicYear: number; referenceWeeklyPeriods: number; maximumWeeklyPeriods: number; periodDurationMinutes: number | null; effectiveFrom: string };
type Assignment = { id: string; teacher_user_id: string; teacher_name: string; teacher_email: string; teacher_staff_reference?: string | null; class_id: string; class_code: string; class_name: string; learning_area_id: string; learning_area: string; grade: number; academic_year: number; starts_on: string; ends_on: string | null; status: string; weekly_periods: number | null; workload_allocation_id: string | null };
type Props = { organisationId: string; teachers: Teacher[]; classes: ClassOption[]; learningAreas: LearningArea[]; assignments: Assignment[]; workloadPolicies: WorkloadPolicy[]; asOfDate: string };

const field = 'mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label = 'block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';

export function TeachingAssignmentManager({ organisationId, teachers, classes, learningAreas, assignments, workloadPolicies, asOfDate }: Props) {
  const router = useRouter();
  const [teacherUserId,setTeacherUserId]=useState(teachers[0]?.userId ?? '');
  const [classId,setClassId]=useState(classes[0]?.id ?? '');
  const [learningAreaId,setLearningAreaId]=useState(learningAreas[0]?.id ?? '');
  const [startsOn,setStartsOn]=useState(new Date().toISOString().slice(0,10));
  const [endsOn,setEndsOn]=useState('');
  const [weeklyPeriods,setWeeklyPeriods]=useState('');
  const [workloadReason,setWorkloadReason]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [referencePeriods,setReferencePeriods]=useState('');
  const [maximumPeriods,setMaximumPeriods]=useState('');
  const [periodDuration,setPeriodDuration]=useState('');
  const [policyEffectiveFrom,setPolicyEffectiveFrom]=useState(new Date().toISOString().slice(0,10));
  const [policyReason,setPolicyReason]=useState('');
  const [editingAssignmentId,setEditingAssignmentId]=useState('');
  const [revisionDrafts,setRevisionDrafts]=useState<Record<string,{weeklyPeriods:string;effectiveFrom:string;reason:string}>>({});

  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('create'); setError(''); setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/teaching-assignments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({teacherUserId,classId,learningAreaId,startsOn,endsOn:endsOn||null,weeklyPeriods:Number(weeklyPeriods),workloadReason})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to create teacher assignment.');
      setMessage('Teacher assignment created and recorded in the audit history.');
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to create teacher assignment.'); }
    finally { setBusy(''); }
  }

  async function savePolicy(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy('policy');setError('');setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/workload-policy',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({academicYear:currentYear,referenceWeeklyPeriods:Number(referencePeriods),maximumWeeklyPeriods:Number(maximumPeriods),periodDurationMinutes:periodDuration===''?null:Number(periodDuration),effectiveFrom:policyEffectiveFrom,reason:policyReason})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to save workload policy');
      setMessage('Workload policy version recorded. Previous policy versions remain in history.');router.refresh();
    } catch(cause){setError(cause instanceof Error?cause.message:'Unable to save workload policy');}
    finally{setBusy('');}
  }

  async function reviseWorkload(assignment:Assignment) {
    const draft=revisionDrafts[assignment.id];
    if(!draft)return;
    setBusy(assignment.id);setError('');setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/teaching-assignments/'+assignment.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({weeklyPeriods:Number(draft.weeklyPeriods),effectiveFrom:draft.effectiveFrom,reason:draft.reason})});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to revise weekly workload');
      setEditingAssignmentId('');setMessage('A new effective-dated workload allocation was recorded. Previous allocation history is retained.');router.refresh();
    } catch(cause){setError(cause instanceof Error?cause.message:'Unable to revise weekly workload');}
    finally{setBusy('');}
  }

  async function revoke(assignmentId:string) {
    if(!window.confirm('Revoke this teacher assignment? The audit history will be retained.')) return;
    setBusy(assignmentId); setError(''); setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/teaching-assignments/'+assignmentId,{method:'DELETE'});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to revoke assignment.');
      setMessage('Teacher assignment revoked.');
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to revoke assignment.'); }
    finally { setBusy(''); }
  }

  const years = Array.from(new Set(assignments.map(a=>a.academic_year))).sort((a,b)=>b-a);
  const currentYear = years[0] ?? new Date().getFullYear();
  const totals = teachers.map(teacher => ({ teacher, periods: assignments.filter(a => a.teacher_user_id===teacher.userId && a.academic_year===currentYear && a.status==='active' && a.weekly_periods!==null && a.starts_on<=asOfDate && (a.ends_on===null || a.ends_on>asOfDate)).reduce((sum,a)=>sum+(a.weekly_periods??0),0) }));
  const policy = workloadPolicies.filter(p=>p.academicYear===currentYear && p.effectiveFrom<=asOfDate).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return <div className="mt-8 space-y-6">
    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <p className="eyebrow">Workforce planning</p><h2 className="mt-2 text-[20px] font-semibold text-[#102B45]">Weekly teaching workload</h2>
      <p className="mt-2 text-[11px] leading-6 text-[#7B909F]">Recurring weekly periods from active teaching assignments, as of {asOfDate}. This is not a daily timetable or an employment decision.</p>
      <p className="mt-3 text-[10px] text-[#718697]">{policy ? 'Year '+currentYear+': reference '+policy.referenceWeeklyPeriods+' · maximum '+policy.maximumWeeklyPeriods+' periods/week' : 'No workload policy configured for '+currentYear+'. Totals are shown without threshold labels.'}</p>
      <form onSubmit={savePolicy} className="mt-4 grid gap-3 rounded-xl border border-[#E5EDF1] bg-[#FBFDFD] p-4 sm:grid-cols-3">
        <label className={label}>Reference periods/week<input required type="number" min="1" max="60" value={referencePeriods} onChange={e=>setReferencePeriods(e.target.value)} className={field}/></label>
        <label className={label}>Maximum periods/week<input required type="number" min="1" max="60" value={maximumPeriods} onChange={e=>setMaximumPeriods(e.target.value)} className={field}/></label>
        <label className={label}>Period duration minutes<input type="number" min="15" max="180" value={periodDuration} onChange={e=>setPeriodDuration(e.target.value)} className={field} placeholder="Optional"/></label>
        <label className={label}>Effective from<input required type="date" value={policyEffectiveFrom} onChange={e=>setPolicyEffectiveFrom(e.target.value)} className={field}/></label>
        <label className={label+" sm:col-span-2"}>Policy reason<input required minLength={10} maxLength={500} value={policyReason} onChange={e=>setPolicyReason(e.target.value)} className={field} placeholder="Institution-approved workload policy basis"/></label>
        <div className="sm:col-span-3"><button disabled={busy!==''} className="rounded-xl bg-[#102B45] px-4 py-3 text-[10px] font-semibold text-white disabled:opacity-40">Record workload policy version</button></div>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{totals.map(({teacher,periods})=><div key={teacher.userId} className="rounded-xl border border-[#E5EDF1] p-3"><p className="text-[11px] font-semibold text-[#29465D]">{teacher.name}</p><p className="mt-1 text-[18px] font-semibold text-[#102B45]">{periods} <span className="text-[10px] font-normal text-[#718697]">periods / week</span></p>{policy&&<p className="mt-1 text-[10px] text-[#718697]">{periods>policy.maximumWeeklyPeriods?'Above maximum':periods>policy.referenceWeeklyPeriods?'Above reference':'Within configured reference'}</p>}</div>)}</div>
    </section>
    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <p className="eyebrow">Controlled allocation</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Assign teachers to classes and learning areas</h2>
      <p className="mt-2 max-w-[760px] text-[11px] leading-6 text-[#7B909F]">Assignments are effective-dated and audited. A teacher must have an active, verified Teacher membership linked to an active staff profile and engagement in this institution. They will only see class-targeted assessment events matching their class, learning area and assignment period.</p>
      {teachers.length===0 ? <div className="mt-5 rounded-xl border border-dashed border-[#CAD9E2] bg-[#F8FBFC] p-4"><p className="text-[12px] font-semibold text-[#29465D]">No eligible teachers yet</p><p className="mt-1 text-[11px] leading-5 text-[#718697]">Create a staff profile and engagement, then link an active verified Teacher account. Assignments are enabled only after both records are in place.</p><div className="mt-3 flex flex-wrap gap-4"><Link href={'/workspace/organisations/'+organisationId+'/staff'} className="text-[11px] font-semibold text-[#087F86]">Open staff register →</Link><Link href={'/workspace/organisations/'+organisationId+'/members'} className="text-[11px] font-semibold text-[#087F86]">Manage institution members →</Link></div></div> :
      classes.length===0 || learningAreas.length===0 ? <p className="mt-5 rounded-xl bg-[#F8FBFC] p-4 text-[11px] text-[#718697]">Create at least one class and ensure curriculum learning areas are available before assigning teachers.</p> :
      <form onSubmit={create} className="mt-6 grid gap-4 rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4 sm:grid-cols-2">
        <label className={label}>Teacher<select required value={teacherUserId} onChange={e=>setTeacherUserId(e.target.value)} className={field}>{teachers.map(t=><option key={t.userId} value={t.userId}>{t.name} · {t.email} · {t.staffReference}</option>)}</select></label>
        <label className={label}>Class<select required value={classId} onChange={e=>setClassId(e.target.value)} className={field}>{classes.map(c=><option key={c.id} value={c.id}>{c.classCode} · {c.displayName} · Grade {c.grade} · {c.academicYear}</option>)}</select></label>
        <label className={label}>Learning area<select required value={learningAreaId} onChange={e=>setLearningAreaId(e.target.value)} className={field}>{learningAreas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className={label}>Weekly teaching periods<input type="number" min="1" max="60" required value={weeklyPeriods} onChange={e=>setWeeklyPeriods(e.target.value)} className={field}/></label>
        <label className={label}>Workload allocation reason<input required minLength={10} maxLength={500} value={workloadReason} onChange={e=>setWorkloadReason(e.target.value)} className={field}/></label>
        <div className="grid grid-cols-2 gap-3"><label className={label}>Starts on<input type="date" required value={startsOn} onChange={e=>setStartsOn(e.target.value)} className={field}/></label><label className={label}>Ends on (exclusive)<input type="date" value={endsOn} min={startsOn} onChange={e=>setEndsOn(e.target.value)} className={field}/></label></div>
        <div className="sm:col-span-2"><button disabled={busy!==''} className="rounded-full bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40">{busy==='create'?'Saving assignment…':'Create teacher assignment'}</button></div>
      </form>}
      {error&&<p role="alert" className="mt-4 text-[11px] text-[#A43D34]">{error}</p>}
      {message&&<p role="status" className="mt-4 text-[11px] text-[#087F86]">{message}</p>}
    </section>
    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">Teaching assignment register</h2><p className="mt-1 text-[11px] text-[#8498A7]">Historical assignments remain visible after revocation.</p></div>
      {assignments.length===0?<p className="px-5 py-9 text-[12px] text-[#8498A7]">No teacher-to-class assignments have been recorded.</p>:<div className="divide-y divide-[#E8EEF2]">{assignments.map(a=><div key={a.id} className="px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[12px] font-semibold text-[#29465D]">{a.teacher_name}{a.teacher_staff_reference?' · '+a.teacher_staff_reference:''} · {a.learning_area}</p><p className="mt-1 text-[11px] text-[#718697]">{a.class_code} · {a.class_name} · Grade {a.grade} · {a.academic_year}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">{a.starts_on} to {a.ends_on??'open-ended'} · {a.status} · {a.weekly_periods===null?'Weekly periods not configured':a.weekly_periods+' periods/week'}</p></div>{a.status==='active'&&<div className="flex flex-wrap gap-2"><button type="button" disabled={busy!==''} onClick={()=>{setEditingAssignmentId(editingAssignmentId===a.id?'':a.id);setRevisionDrafts(old=>({...old,[a.id]:old[a.id]??{weeklyPeriods:String(a.weekly_periods??''),effectiveFrom:asOfDate,reason:''}}));}} className="rounded-full border border-[#DCE7EC] px-3 py-2 text-[10px] font-semibold text-[#29465D] disabled:opacity-40">Change weekly periods</button><button type="button" disabled={busy!==''} onClick={()=>void revoke(a.id)} className="rounded-full border border-[#E7D4D0] px-3 py-2 text-[10px] font-semibold text-[#A43D34] disabled:opacity-40">{busy===a.id?'Revoking…':'Revoke assignment'}</button></div>}</div>{editingAssignmentId===a.id&&<div className="mt-3 grid gap-2 rounded-xl bg-[#F8FBFC] p-3 sm:grid-cols-3"><label className={label}>New periods/week<input type="number" min="1" max="60" value={revisionDrafts[a.id]?.weeklyPeriods??''} onChange={e=>setRevisionDrafts(old=>({...old,[a.id]:{...old[a.id],weeklyPeriods:e.target.value}}))} className={field}/></label><label className={label}>Effective from<input type="date" min={asOfDate} value={revisionDrafts[a.id]?.effectiveFrom??asOfDate} onChange={e=>setRevisionDrafts(old=>({...old,[a.id]:{...old[a.id],effectiveFrom:e.target.value}}))} className={field}/></label><label className={label}>Reason<input minLength={10} maxLength={500} value={revisionDrafts[a.id]?.reason??''} onChange={e=>setRevisionDrafts(old=>({...old,[a.id]:{...old[a.id],reason:e.target.value}}))} className={field}/></label><div className="sm:col-span-3"><button type="button" disabled={busy!==''||!revisionDrafts[a.id]?.weeklyPeriods||Number(revisionDrafts[a.id]?.weeklyPeriods)<1||(revisionDrafts[a.id]?.reason.trim().length??0)<10} onClick={()=>void reviseWorkload(a)} className="rounded-lg bg-[#102B45] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-40">Save effective-dated change</button></div></div>}</div>)}</div>}
    </section>
  </div>;
}
