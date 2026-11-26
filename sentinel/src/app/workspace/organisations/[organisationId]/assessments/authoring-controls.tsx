'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { OutcomeMappingControls } from './outcome-mapping-controls';

type Programme = { id: string; code: string; title: string; type: string };
type Instrument = { id: string; code: string; version: number; title: string; grade: number; learningAreaId: string; status: string; createdBy: string };
type LearningArea = { id: string; name: string };
type GradeOffering = { id: string; grade: number; learning_area_id: string; learning_area: string; edition_label: string; pathway_name: string; availability_status: string };
type TaskDraft = { taskCode: string; title: string; responseType: 'text'|'numeric'|'boolean'|'choice'|'observation'|'evidence'; maximumScore: string; required: boolean };
type Props = { organisationId: string; actorUserId: string; programmes: Programme[]; instruments: Instrument[]; learningAreas: LearningArea[]; gradeOfferings: GradeOffering[]; timeZone: string };

const inputClass = 'mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const labelClass = 'block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';

export function AssessmentAuthoringControls({ organisationId, actorUserId, programmes, instruments, learningAreas, gradeOfferings, timeZone }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [programmeCode, setProgrammeCode] = useState('');
  const [programmeTitle, setProgrammeTitle] = useState('');
  const [programmeType, setProgrammeType] = useState('summative');
  const [instrumentCode, setInstrumentCode] = useState('');
  const [instrumentTitle, setInstrumentTitle] = useState('');
  const [learningAreaId, setLearningAreaId] = useState(learningAreas[0]?.id ?? '');
  const [grade, setGrade] = useState('6');
  const [gradeOfferingId, setGradeOfferingId] = useState(gradeOfferings.find(item => item.grade === 6 && item.learning_area_id === (learningAreas[0]?.id ?? ''))?.id ?? '');
  const [tasks, setTasks] = useState<TaskDraft[]>([{ taskCode: 'TASK-01', title: '', responseType: 'text', maximumScore: '10', required: true }]);
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? '');
  const [instrumentVersionId, setInstrumentVersionId] = useState(instruments.find(item => item.status === 'approved')?.id ?? '');
  const [eventTitle, setEventTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [moderationRequired, setModerationRequired] = useState(true);
  const matchingGradeOfferings = gradeOfferings.filter(item => item.grade === Number(grade) && item.learning_area_id === learningAreaId);

  async function send(path: string, body: unknown, label: string) {
    setBusy(label); setError(''); setMessage('');
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The operation could not be completed.');
      setMessage(label + ' completed successfully.');
      router.refresh();
      return payload;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The operation could not be completed.'); return null; }
    finally { setBusy(''); }
  }

  async function createProgramme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await send(`/api/organisations/${organisationId}/assessments/programmes`, { programmeCode, title: programmeTitle, programmeType }, 'Programme creation');
    if (result?.programmeId) { setProgrammeCode(''); setProgrammeTitle(''); }
  }
  async function createInstrument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await send(`/api/organisations/${organisationId}/assessments/instruments`, {
      curriculumGradeOfferingId: gradeOfferingId, instrumentCode, title: instrumentTitle,
      tasks: tasks.map((task, index) => ({ ...task, maximumScore: Number(task.maximumScore), displayOrder: index })),
    }, 'Instrument draft creation');
    if (result?.instrumentVersionId) { setInstrumentCode(''); setInstrumentTitle(''); setTasks([{ taskCode: 'TASK-01', title: '', responseType: 'text', maximumScore: '10', required: true }]); }
  }
  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startsAt || !endsAt || startsAt >= endsAt) { setError('The event end must be after its start.'); return; }
    await send(`/api/organisations/${organisationId}/assessments/events`, {
      programmeId, instrumentVersionId, title: eventTitle, startsAtLocal: startsAt,
      endsAtLocal: endsAt, academicYear: Number(academicYear), moderationRequired,
    }, 'Event creation');
  }
  async function approve(instrument: Instrument) {
    await send(`/api/organisations/${organisationId}/assessments/instruments/${instrument.id}/approve`, {}, 'Instrument approval');
  }

  return <section className="mt-8 rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
    <div><p className="eyebrow">Assessment setup</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Authoring and scheduling</h2><p className="mt-2 max-w-[760px] text-[11px] leading-6 text-[#7B909F]">Create an assessment programme, draft a versioned instrument, obtain independent approval, then create and schedule an event. Scheduling freezes the eligible learner roster.</p></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <form onSubmit={createProgramme} className="rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4">
        <h3 className="text-[13px] font-semibold text-[#29465D]">1. Assessment programme</h3>
        <label className={labelClass + ' mt-4'}>Programme code<input required minLength={2} maxLength={64} value={programmeCode} onChange={event => setProgrammeCode(event.target.value)} placeholder="e.g. G6-TERM2" className={inputClass}/></label>
        <label className={labelClass + ' mt-3'}>Programme title<input required minLength={3} maxLength={180} value={programmeTitle} onChange={event => setProgrammeTitle(event.target.value)} placeholder="Term 2 learning assessment" className={inputClass}/></label>
        <label className={labelClass + ' mt-3'}>Programme type<select value={programmeType} onChange={event => setProgrammeType(event.target.value)} className={inputClass}><option value="formative">Formative</option><option value="summative">Summative</option><option value="diagnostic">Diagnostic</option></select></label>
        <button disabled={busy !== ''} className="mt-4 rounded-full bg-[#102B45] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40">{busy === 'Programme creation' ? 'Creating…' : 'Create programme'}</button>
        <p className="mt-3 text-[10px] text-[#8A9CAB]">{programmes.length} active programme(s) available</p>
      </form>
      <form onSubmit={createInstrument} className="rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4">
        <h3 className="text-[13px] font-semibold text-[#29465D]">2. Instrument version draft</h3>
        <div className="mt-4 grid grid-cols-2 gap-3"><label className={labelClass}>Grade<select value={grade} onChange={event => { const nextGrade = event.target.value; setGrade(nextGrade); const first = gradeOfferings.find(item => item.grade === Number(nextGrade) && item.learning_area_id === learningAreaId); setGradeOfferingId(first?.id ?? ''); }} className={inputClass}>{Array.from({length:9},(_,i)=><option key={i+1} value={i+1}>Grade {i+1}</option>)}</select></label><label className={labelClass}>Learning area<select required value={learningAreaId} onChange={event => { const nextArea = event.target.value; setLearningAreaId(nextArea); const first = gradeOfferings.find(item => item.grade === Number(grade) && item.learning_area_id === nextArea); setGradeOfferingId(first?.id ?? ''); }} className={inputClass}>{learningAreas.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}</select></label></div>\n        <label className={labelClass + ' mt-3'}>Curriculum edition and pathway<select required value={gradeOfferingId} onChange={event => setGradeOfferingId(event.target.value)} className={inputClass}><option value="">Select a curriculum catalogue offering</option>{matchingGradeOfferings.map(item=><option key={item.id} value={item.id}>{item.edition_label} · {item.pathway_name} · {item.availability_status}</option>)}</select></label>
        <label className={labelClass + ' mt-3'}>Instrument code<input required value={instrumentCode} onChange={event => setInstrumentCode(event.target.value)} placeholder="e.g. G6-MATH-T2" className={inputClass}/></label>
        <label className={labelClass + ' mt-3'}>Instrument title<input required value={instrumentTitle} onChange={event => setInstrumentTitle(event.target.value)} placeholder="Grade 6 Mathematics assessment" className={inputClass}/></label>
        <div className="mt-4 flex items-center justify-between"><p className={labelClass}>Tasks</p><button type="button" onClick={() => setTasks(current => [...current, { taskCode: `TASK-${String(current.length+1).padStart(2,'0')}`, title: '', responseType: 'text', maximumScore: '10', required: true }])} className="text-[10px] font-semibold text-[#087F86]">+ Add task</button></div>
        {tasks.map((task,index)=><div key={index} className="mt-3 rounded-xl border border-[#E5EDF1] bg-white p-3"><div className="grid grid-cols-2 gap-2"><label className={labelClass}>Task code<input required value={task.taskCode} onChange={event => setTasks(current => current.map((item,i)=>i===index?{...item,taskCode:event.target.value}:item))} className={inputClass}/></label><label className={labelClass}>Maximum score<input required type="number" min="0.01" step="0.01" value={task.maximumScore} onChange={event => setTasks(current => current.map((item,i)=>i===index?{...item,maximumScore:event.target.value}:item))} className={inputClass}/></label></div><label className={labelClass + ' mt-2'}>Task title<input required value={task.title} onChange={event => setTasks(current => current.map((item,i)=>i===index?{...item,title:event.target.value}:item))} className={inputClass}/></label><div className="mt-2 flex flex-wrap items-center gap-3"><select value={task.responseType} onChange={event => setTasks(current => current.map((item,i)=>i===index?{...item,responseType:event.target.value as TaskDraft['responseType']}:item))} className="rounded-lg border border-[#DCE7EC] px-2 py-2 text-[10px] text-[#29465D]">{['text','numeric','boolean','choice','observation','evidence'].map(type=><option key={type} value={type}>{type}</option>)}</select><label className="flex items-center gap-2 text-[10px] text-[#647D8D]"><input type="checkbox" checked={task.required} onChange={event => setTasks(current => current.map((item,i)=>i===index?{...item,required:event.target.checked}:item))}/>Required</label>{tasks.length>1 && <button type="button" onClick={()=>setTasks(current=>current.filter((_,i)=>i!==index))} className="ml-auto text-[10px] text-[#A43D34]">Remove</button>}</div></div>)}
        <button disabled={busy !== '' || learningAreas.length===0 || !gradeOfferingId} className="mt-4 rounded-full bg-[#102B45] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40">{busy === 'Instrument draft creation' ? 'Creating…' : 'Save instrument draft'}</button>
      </form>
    </div>
    <div className="mt-5 rounded-2xl border border-[#E5EDF1] p-4"><h3 className="text-[13px] font-semibold text-[#29465D]">3. Independent instrument approval</h3><p className="mt-1 text-[10px] text-[#8498A7]">The author cannot approve their own instrument version.</p>{instruments.length===0 ? <p className="mt-3 text-[11px] text-[#8A9CAB]">No instrument versions yet.</p> : <div className="mt-3 divide-y divide-[#EDF1F3]">{instruments.map(instrument=><div key={instrument.id} className="border-b border-[#EDF1F3] py-3 last:border-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-semibold text-[#29465D]">{instrument.code} v{instrument.version} · {instrument.title}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">Grade {instrument.grade} · {instrument.status}</p></div>{instrument.status==='draft' && instrument.createdBy!==actorUserId ? <button type="button" disabled={busy!==''} onClick={()=>void approve(instrument)} className="rounded-full border border-[#CFE1E6] px-3 py-2 text-[10px] font-semibold text-[#087F86]">Approve version</button> : instrument.status==='draft' ? <span className="text-[10px] text-[#9AABB7]">Awaiting a different approver</span> : null}</div><OutcomeMappingControls organisationId={organisationId} instrumentVersionId={instrument.id} actorUserId={actorUserId} instrumentStatus={instrument.status}/></div>)}</div>}</div>
    <form onSubmit={createEvent} className="mt-5 rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4">
      <h3 className="text-[13px] font-semibold text-[#29465D]">4. Create assessment event</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Programme<select required value={programmeId} onChange={event=>setProgrammeId(event.target.value)} className={inputClass}>{programmes.map(item=><option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label><label className={labelClass}>Approved instrument<select required value={instrumentVersionId} onChange={event=>setInstrumentVersionId(event.target.value)} className={inputClass}>{instruments.filter(item=>item.status==='approved').map(item=><option key={item.id} value={item.id}>{item.code} v{item.version} · Grade {item.grade}</option>)}</select></label></div>
      <label className={labelClass + ' mt-3'}>Event title<input required value={eventTitle} onChange={event=>setEventTitle(event.target.value)} placeholder="Grade 6 Term 2 Mathematics" className={inputClass}/></label>
      <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className={labelClass}>Starts (institution time)<input required type="datetime-local" value={startsAt} onChange={event=>setStartsAt(event.target.value)} className={inputClass}/></label><label className={labelClass}>Ends (institution time)<input required type="datetime-local" value={endsAt} onChange={event=>setEndsAt(event.target.value)} className={inputClass}/></label><label className={labelClass}>Academic year<input required type="number" min="2000" max="2100" value={academicYear} onChange={event=>setAcademicYear(event.target.value)} className={inputClass}/></label></div>
      <label className="mt-4 flex items-center gap-2 text-[11px] text-[#647D8D]"><input type="checkbox" checked={moderationRequired} onChange={event=>setModerationRequired(event.target.checked)}/> Require independent moderation</label>
      <button disabled={busy!=='' || programmes.length===0 || instruments.every(item=>item.status!=='approved')} className="mt-4 rounded-full bg-[#087F86] px-5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40">{busy==='Event creation'?'Creating…':'Create draft event'}</button>
      <p className="mt-2 text-[10px] text-[#8A9CAB]">Times are interpreted in the institution&apos;s {timeZone} time zone and stored as UTC instants. Roster eligibility uses the institution-local calendar date.</p>
    </form>
    {error && <p role="alert" className="mt-4 text-[11px] text-[#A43D34]">{error}</p>}{message && <p role="status" className="mt-4 text-[11px] text-[#087F86]">{message}</p>}
  </section>;
}
