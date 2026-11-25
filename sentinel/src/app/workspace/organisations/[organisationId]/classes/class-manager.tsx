'use client';

import { FormEvent, useState } from 'react';

type ClassRecord = { id: string; classCode: string; displayName: string; grade: number; academicYear: number; status: string };

export function ClassManager({ organisationId, initialClasses }: { organisationId: string; initialClasses: ClassRecord[] }) {
  const [classes, setClasses] = useState(initialClasses);
  const [grade, setGrade] = useState('1');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [classCode, setClassCode] = useState('A');
  const [displayName, setDisplayName] = useState('Grade 1 A');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function addClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/classes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grade: Number(grade), academicYear: Number(academicYear), classCode, displayName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create class');
      const refresh = await fetch(`/api/organisations/${organisationId}/classes`);
      const latest = await refresh.json();
      if (refresh.ok) setClasses(latest.classes);
      setNotice(`${result.class.displayName} was created.`);
      setClassCode(''); setDisplayName('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create class'); }
    finally { setPending(false); }
  }

  return <div className="mt-9 space-y-6">
    <section className="rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8">
      <p className="eyebrow">Class organisation</p>
      <h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Create a class group</h2>
      <p className="mt-2 text-[12px] leading-6 text-[#718697]">Create an organisation-owned class for one grade and academic year. Learner placement and teacher allocation are separate workflows and are not enabled here.</p>
      <form onSubmit={addClass} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] font-semibold text-[#29465D]">Grade<select value={grade} onChange={event=>setGrade(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[13px] font-normal">{Array.from({length:9},(_,i)=>i+1).map(value=><option key={value} value={value}>Grade {value}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Academic year<input required type="number" min={2000} max={2100} value={academicYear} onChange={event=>setAcademicYear(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-3 py-3 text-[13px] font-normal"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Class code<input required maxLength={40} value={classCode} onChange={event=>setClassCode(event.target.value)} placeholder="A" className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Display name<input required maxLength={120} value={displayName} onChange={event=>setDisplayName(event.target.value)} placeholder="Grade 1 East" className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <div className="sm:col-span-2 lg:col-span-4"><button type="submit" disabled={pending} className="rounded-xl bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-60">{pending ? 'Saving…' : 'Create class'}</button></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="flex items-center justify-between border-b border-[#EAF0F4] px-6 py-5"><div><h2 className="text-[13px] font-semibold text-[#29465D]">Class register</h2><p className="mt-1 text-[10px] text-[#91A3B0]">Active and archived class groups</p></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{classes.length} classes</span></div>
      {classes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#FAFCFD] text-[9px] uppercase tracking-[.12em] text-[#8A9CAB]"><tr><th className="px-6 py-3">Class</th><th className="px-6 py-3">Code</th><th className="px-6 py-3">Grade</th><th className="px-6 py-3">Academic year</th><th className="px-6 py-3">Status</th></tr></thead><tbody className="divide-y divide-[#EDF2F5]">{classes.map(item=><tr key={item.id}><td className="px-6 py-4 text-[12px] font-semibold text-[#18364E]">{item.displayName}</td><td className="px-6 py-4 font-mono text-[10px] text-[#6D8495]">{item.classCode}</td><td className="px-6 py-4 text-[11px] text-[#456176]">{item.grade}</td><td className="px-6 py-4 text-[11px] text-[#456176]">{item.academicYear}</td><td className="px-6 py-4 text-[11px] text-[#456176]">{item.status}</td></tr>)}</tbody></table></div> : <div className="px-6 py-12 text-center text-[12px] text-[#8195A4]">No classes have been created for this organisation.</div>}
    </section>
    {error && <p role="alert" className="rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[11px] text-[#B42318]">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-[#DDEBEA] bg-[#F2F8F8] p-3 text-[11px] text-[#087F86]">{notice}</p>}
  </div>;
}
