'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Teacher = { userId: string; name: string; email: string; staffReference: string };
type ClassOption = { id: string; classCode: string; displayName: string; grade: number; academicYear: number };
type LearningArea = { id: string; name: string };
type Assignment = { id: string; teacher_user_id: string; teacher_name: string; teacher_email: string; teacher_staff_reference?: string | null; class_id: string; class_code: string; class_name: string; learning_area_id: string; learning_area: string; grade: number; academic_year: number; starts_on: string; ends_on: string | null; status: string };
type Props = { organisationId: string; teachers: Teacher[]; classes: ClassOption[]; learningAreas: LearningArea[]; assignments: Assignment[] };

const field = 'mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label = 'block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';

export function TeachingAssignmentManager({ organisationId, teachers, classes, learningAreas, assignments }: Props) {
  const router = useRouter();
  const [teacherUserId,setTeacherUserId]=useState(teachers[0]?.userId ?? '');
  const [classId,setClassId]=useState(classes[0]?.id ?? '');
  const [learningAreaId,setLearningAreaId]=useState(learningAreas[0]?.id ?? '');
  const [startsOn,setStartsOn]=useState(new Date().toISOString().slice(0,10));
  const [endsOn,setEndsOn]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('create'); setError(''); setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/teaching-assignments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({teacherUserId,classId,learningAreaId,startsOn,endsOn:endsOn||null})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to create teacher assignment.');
      setMessage('Teacher assignment created and recorded in the audit history.');
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to create teacher assignment.'); }
    finally { setBusy(''); }
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

  return <div className="mt-8 space-y-6">
    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <p className="eyebrow">Controlled allocation</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Assign teachers to classes and learning areas</h2>
      <p className="mt-2 max-w-[760px] text-[11px] leading-6 text-[#7B909F]">Assignments are effective-dated and audited. A teacher must have an active, verified Teacher membership linked to an active staff profile and engagement in this institution. They will only see class-targeted assessment events matching their class, learning area and assignment period.</p>
      {teachers.length===0 ? <div className="mt-5 rounded-xl border border-dashed border-[#CAD9E2] bg-[#F8FBFC] p-4"><p className="text-[12px] font-semibold text-[#29465D]">No eligible teachers yet</p><p className="mt-1 text-[11px] leading-5 text-[#718697]">Add a verified user with the Teacher role before creating teaching assignments.</p><Link href={'/workspace/organisations/'+organisationId+'/members'} className="mt-3 inline-block text-[11px] font-semibold text-[#087F86]">Manage institution members →</Link></div> :
      classes.length===0 || learningAreas.length===0 ? <p className="mt-5 rounded-xl bg-[#F8FBFC] p-4 text-[11px] text-[#718697]">Create at least one class and ensure curriculum learning areas are available before assigning teachers.</p> :
      <form onSubmit={create} className="mt-6 grid gap-4 rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4 sm:grid-cols-2">
        <label className={label}>Teacher<select required value={teacherUserId} onChange={e=>setTeacherUserId(e.target.value)} className={field}>{teachers.map(t=><option key={t.userId} value={t.userId}>{t.name} · {t.email} · {t.staffReference}</option>)}</select></label>
        <label className={label}>Class<select required value={classId} onChange={e=>setClassId(e.target.value)} className={field}>{classes.map(c=><option key={c.id} value={c.id}>{c.classCode} · {c.displayName} · Grade {c.grade} · {c.academicYear}</option>)}</select></label>
        <label className={label}>Learning area<select required value={learningAreaId} onChange={e=>setLearningAreaId(e.target.value)} className={field}>{learningAreas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className={label}>Starts on<input type="date" required value={startsOn} onChange={e=>setStartsOn(e.target.value)} className={field}/></label><label className={label}>Ends on (exclusive)<input type="date" value={endsOn} min={startsOn} onChange={e=>setEndsOn(e.target.value)} className={field}/></label></div>
        <div className="sm:col-span-2"><button disabled={busy!==''} className="rounded-full bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40">{busy==='create'?'Saving assignment…':'Create teacher assignment'}</button></div>
      </form>}
      {error&&<p role="alert" className="mt-4 text-[11px] text-[#A43D34]">{error}</p>}
      {message&&<p role="status" className="mt-4 text-[11px] text-[#087F86]">{message}</p>}
    </section>
    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">Teaching assignment register</h2><p className="mt-1 text-[11px] text-[#8498A7]">Historical assignments remain visible after revocation.</p></div>
      {assignments.length===0?<p className="px-5 py-9 text-[12px] text-[#8498A7]">No teacher-to-class assignments have been recorded.</p>:<div className="divide-y divide-[#E8EEF2]">{assignments.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="text-[12px] font-semibold text-[#29465D]">{a.teacher_name}{a.teacher_staff_reference?' · '+a.teacher_staff_reference:''} · {a.learning_area}</p><p className="mt-1 text-[11px] text-[#718697]">{a.class_code} · {a.class_name} · Grade {a.grade} · {a.academic_year}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">{a.starts_on} to {a.ends_on??'open-ended'} · {a.status}</p></div>{a.status==='active'&&<button type="button" disabled={busy!==''} onClick={()=>void revoke(a.id)} className="rounded-full border border-[#E7D4D0] px-3 py-2 text-[10px] font-semibold text-[#A43D34] disabled:opacity-40">{busy===a.id?'Revoking…':'Revoke assignment'}</button>}</div>)}</div>}
    </section>
  </div>;
}
