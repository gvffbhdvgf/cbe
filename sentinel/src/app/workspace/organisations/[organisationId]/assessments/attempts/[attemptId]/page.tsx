import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getAssessmentAttemptMarkingSheet } from '@/application/assessment/assessment-service';
import { AssessmentMarkingControls, type MarkingTask } from './marking-controls';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MarkingSheetRow = MarkingTask & { event_id: string; event_title: string; event_status: string; attempt_id: string; enrolment_id: string; attempt_status: string; task_code: string; response_type: string; display_order: number; response_payload: unknown; captured_at: Date | string | null; result_id: string | null; lifecycle_status: string | null; latest_decision_type: string | null; latest_decision_at: Date | string | null };

export default function AssessmentAttemptPage({ params }: { params: Promise<{ organisationId: string; attemptId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading marking sheet…</main>}><AssessmentAttemptContent params={params}/></Suspense>;
}

async function AssessmentAttemptContent({ params }: { params: Promise<{ organisationId: string; attemptId: string }> }) {
  await connection();
  const { organisationId, attemptId } = await params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(attemptId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let tasks: MarkingSheetRow[];
  try { tasks = await getAssessmentAttemptMarkingSheet(data.user.id, organisationId, attemptId) as MarkingSheetRow[]; }
  catch { redirect('/workspace/organisations'); }
  if (tasks.length===0) notFound();
  const first=tasks[0];

  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href={`/workspace/organisations/${organisationId}/assessments/events/${first.event_id}`} className="text-[11px] font-semibold text-[#087F86]">← Event results</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1000px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <p className="eyebrow">Assessment marking sheet</p><h1 className="mt-3 text-[32px] font-semibold tracking-[-.05em] text-[#102B45]">{first.event_title}</h1><p className="mt-2 text-[11px] text-[#718697]">Attempt {attemptId} · {first.attempt_status} · Enrolment {first.enrolment_id}</p>
      <div className="mt-8 space-y-3">{tasks.map(task=><article key={task.task_id} className="rounded-[18px] border border-[#E1EAF0] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#8A9CAB]">{task.task_code} · {task.response_type} {task.required?'· Required':'· Optional'}</p><h2 className="mt-2 text-[15px] font-semibold text-[#29465D]">{task.task_title}</h2></div><p className="text-[11px] font-semibold text-[#087F86]">Maximum {task.maximum_score}</p></div><div className="mt-4 rounded-xl bg-[#F6F9FA] p-4"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8A9CAB]">Captured response</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-6 text-[#456175]">{JSON.stringify(task.response_payload??null,null,2)}</pre></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#8A9CAB]"><span>{task.response_id ? (task.captured_at ? 'Captured ' + new Date(task.captured_at).toLocaleString() : 'Captured') : 'No response captured'}</span>{task.mark_id ? <span>Latest mark v{task.mark_version}: {task.awarded_score} · {task.marker_note}</span> : <span>Not marked</span>}</div></article>)}</div>
      <AssessmentMarkingControls organisationId={organisationId} attemptId={attemptId} attemptStatus={first.attempt_status} latestDecisionType={first.latest_decision_type ?? null} latestDecisionAt={first.latest_decision_at ?? null} tasks={tasks}/>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Immutable response evidence · Versioned marks</span></footer>
    </div>
  </main>;
}
