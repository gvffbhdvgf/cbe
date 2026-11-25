'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type Learner = { id: string; enrolmentId: string; learnerReference: string; firstName: string; middleName: string | null; lastName: string; preferredName: string | null; grade: number; academicYear: number; enrolmentStatus: string; startsAt: string; classId: string | null; className: string | null };
type ClassOption = { id: string; classCode: string; displayName: string; grade: number; academicYear: number; status: string };

export function LearnerManager({ organisationId, initialLearners, initialClasses }: { organisationId: string; initialLearners: Learner[]; initialClasses: ClassOption[] }) {
  const [learners, setLearners] = useState(initialLearners);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [grade, setGrade] = useState('1');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [selectedClasses, setSelectedClasses] = useState<Record<string, string>>({});
  const [placementDates, setPlacementDates] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [assigning, setAssigning] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshLearners() {
    const refresh = await fetch(`/api/organisations/${organisationId}/learners`);
    const latest = await refresh.json();
    if (refresh.ok) setLearners(latest.learners);
  }

  async function addLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/learners`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firstName, middleName, lastName, preferredName, dateOfBirth: dateOfBirth || undefined, grade: Number(grade), academicYear: Number(academicYear) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to register learner');
      await refreshLearners();
      setFirstName(''); setMiddleName(''); setLastName(''); setPreferredName(''); setDateOfBirth('');
      setNotice(`Learner record ${result.learner.learnerReference} was created.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to register learner'); }
    finally { setPending(false); }
  }

  async function assignClass(learner: Learner) {
    const classId = selectedClasses[learner.enrolmentId];
    if (!classId) { setError('Select a matching class before assigning the learner.'); return; }
    setAssigning(learner.enrolmentId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/enrolments/${learner.enrolmentId}/class`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, effectiveAt: placementDates[learner.enrolmentId] || new Date().toISOString().slice(0, 10) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to place learner in class');
      await refreshLearners();
      setNotice(`Learner ${learner.learnerReference} was placed in the selected class.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to place learner in class'); }
    finally { setAssigning(''); }
  }

  return <div className="mt-9 space-y-6">
    <section className="rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8">
      <p className="eyebrow">Admissions</p><h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Register a learner</h2>
      <p className="mt-2 text-[12px] leading-6 text-[#718697]">Only collect information required for admission. Date of birth is optional; no national identifier, health or disability details, photograph or guardian contact information is collected here.</p>
      <form onSubmit={addLearner} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-[11px] font-semibold text-[#29465D]">First name *<input required maxLength={120} value={firstName} onChange={event=>setFirstName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Middle name<input maxLength={120} value={middleName} onChange={event=>setMiddleName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Last name *<input required maxLength={120} value={lastName} onChange={event=>setLastName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Preferred name<input maxLength={120} value={preferredName} onChange={event=>setPreferredName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Date of birth (optional)<input type="date" value={dateOfBirth} onChange={event=>setDateOfBirth(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-[11px] font-semibold text-[#29465D]">Grade<select value={grade} onChange={event=>setGrade(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[13px] font-normal">{Array.from({length:9},(_,i)=>i+1).map(value=><option key={value} value={value}>{value}</option>)}</select></label><label className="text-[11px] font-semibold text-[#29465D]">Academic year<input type="number" min={2000} max={2100} value={academicYear} onChange={event=>setAcademicYear(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[13px] font-normal"/></label></div>
        <div className="sm:col-span-2 lg:col-span-3"><button type="submit" disabled={pending} className="rounded-xl bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-60">{pending ? 'Saving…' : 'Create learner record'}</button></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white"><div className="flex items-center justify-between border-b border-[#EAF0F4] px-6 py-5"><div><h2 className="text-[13px] font-semibold text-[#29465D]">Current learner register</h2><p className="mt-1 text-[10px] text-[#91A3B0]">Current active enrolments only</p></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{learners.length} learners</span></div>
      {learners.length ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead className="bg-[#FAFCFD] text-[9px] uppercase tracking-[.12em] text-[#8A9CAB]"><tr><th className="px-6 py-3">Learner</th><th className="px-6 py-3">Reference</th><th className="px-6 py-3">Grade</th><th className="px-6 py-3">Year</th><th className="px-6 py-3">Class / placement</th></tr></thead><tbody className="divide-y divide-[#EDF2F5]">{learners.map(learner=>{
        const options=initialClasses.filter(item=>item.grade===learner.grade&&item.academicYear===learner.academicYear&&item.status==='active');
        return <tr key={learner.id}><td className="px-6 py-4"><p className="text-[12px] font-semibold text-[#18364E]">{learner.preferredName || learner.firstName} {learner.lastName}</p><p className="mt-1 text-[10px] text-[#91A3B0]">{learner.enrolmentStatus}</p></td><td className="px-6 py-4 font-mono text-[10px] text-[#6D8495]">{learner.learnerReference}</td><td className="px-6 py-4 text-[11px] text-[#456176]">{learner.grade}</td><td className="px-6 py-4 text-[11px] text-[#456176]">{learner.academicYear}</td><td className="px-6 py-4">{learner.classId ? <p className="text-[11px] font-medium text-[#456176]">{learner.className || 'Class assigned'}</p> : options.length ? <div className="flex min-w-[300px] flex-wrap items-center gap-2"><select aria-label={`Class for ${learner.learnerReference}`} value={selectedClasses[learner.enrolmentId]||''} onChange={event=>setSelectedClasses(current=>({...current,[learner.enrolmentId]:event.target.value}))} className="min-w-[150px] rounded-lg border border-[#DCE6EC] bg-[#FAFCFD] px-2 py-2 text-[10px]"><option value="">Select class</option>{options.map(item=><option key={item.id} value={item.id}>{item.displayName} ({item.classCode})</option>)}</select><input aria-label={`Placement effective date for ${learner.learnerReference}`} type="date" value={placementDates[learner.enrolmentId]||new Date().toISOString().slice(0,10)} onChange={event=>setPlacementDates(current=>({...current,[learner.enrolmentId]:event.target.value}))} className="rounded-lg border border-[#DCE6EC] bg-[#FAFCFD] px-2 py-2 text-[10px]"/><button type="button" disabled={assigning===learner.enrolmentId} onClick={()=>assignClass(learner)} className="rounded-lg bg-[#102B45] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60">{assigning===learner.enrolmentId?'Placing…':'Place'}</button></div> : <Link href={`/workspace/organisations/${organisationId}/classes`} className="text-[10px] font-semibold text-[#087F86] hover:underline">Create matching class →</Link>}</td></tr>;
      })}</tbody></table></div> : <div className="px-6 py-12 text-center text-[12px] text-[#8195A4]">No learner records have been registered in this organisation.</div>}
    </section>
    {error && <p role="alert" className="rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[11px] text-[#B42318]">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-[#DDEBEA] bg-[#F2F8F8] p-3 text-[11px] text-[#087F86]">{notice}</p>}
  </div>;
}
