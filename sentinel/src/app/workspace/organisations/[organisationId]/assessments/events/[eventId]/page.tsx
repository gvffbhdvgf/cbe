import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getAssessmentEventResults, listAssessmentEvents } from '@/application/assessment/assessment-service';
import { getOrganisationActorRole } from '@/application/organisation/membership-service';
import { AssessmentResultDecisionControls } from './result-decision-controls';
import { AssessmentAttemptVoidControl } from './void-attempt-control';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AssessmentEventResultsPage({ params }: { params: Promise<{ organisationId: string; eventId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading event results…</main>}><AssessmentEventResultsContent params={params}/></Suspense>;
}

async function AssessmentEventResultsContent({ params }: { params: Promise<{ organisationId: string; eventId: string }> }) {
  await connection();
  const { organisationId, eventId } = await params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(eventId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let event;
  let attempts;
  let actorRole;
  try {
    const [events, resultRows, role] = await Promise.all([
      listAssessmentEvents(data.user.id, organisationId),
      getAssessmentEventResults(data.user.id, organisationId, eventId),
      getOrganisationActorRole(data.user.id, organisationId),
    ]);
    event = events.find(item => item.id === eventId);
    attempts = resultRows;
    actorRole = role;
  } catch { redirect('/workspace/organisations'); }
  if (!event) notFound();
  const canApprove = ['organisation_admin', 'school_admin', 'platform_admin'].includes(actorRole ?? '');

  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href={`/workspace/organisations/${organisationId}/assessments`} className="text-[11px] font-semibold text-[#087F86]">← Assessment events</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <p className="eyebrow">Assessment event</p><h1 className="mt-3 text-[34px] font-semibold tracking-[-.05em] text-[#102B45]">{event.title}</h1><p className="mt-2 text-[12px] text-[#718697]">Grade {event.grade} · {event.learningArea} · {event.academicYear} · {event.status}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#E1EAF0] bg-white p-5"><p className="text-[10px] uppercase tracking-[.14em] text-[#8A9CAB]">Attempts</p><p className="mt-2 text-[26px] font-semibold text-[#18364E]">{attempts.length}</p></div><div className="rounded-2xl border border-[#E1EAF0] bg-white p-5"><p className="text-[10px] uppercase tracking-[.14em] text-[#8A9CAB]">Submitted / marked</p><p className="mt-2 text-[26px] font-semibold text-[#18364E]">{attempts.filter((item:any)=>['submitted','marked','moderated','approved'].includes(item.attempt_status)).length}</p></div><div className="rounded-2xl border border-[#E1EAF0] bg-white p-5"><p className="text-[10px] uppercase tracking-[.14em] text-[#8A9CAB]">Published results</p><p className="mt-2 text-[26px] font-semibold text-[#18364E]">{attempts.filter((item:any)=>item.lifecycle_status==='published').length}</p></div></div>
      <section className="mt-9 overflow-hidden rounded-[18px] border border-[#E1EAF0] bg-white">
        <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">Learner attempts and results</h2><p className="mt-1 text-[11px] text-[#8498A7]">Learner identity is represented by the enrolment reference in this operational view.</p></div>
        {attempts.length===0 ? <p className="px-5 py-10 text-[12px] text-[#8498A7]">No learner attempts have been created for this event.</p> : <div className="divide-y divide-[#E8EEF2]">{attempts.map((item:any)=><div key={item.attempt_id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="text-[12px] font-semibold text-[#29465D]">Enrolment {item.enrolment_id}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">Attempt {item.attempt_id} · {item.attempt_status}</p>{item.result_id ? <p className="mt-1 text-[11px] text-[#718697]">Result v{item.result_version} · {item.total_awarded_score}/{item.maximum_score} · {item.percentage}% · {item.lifecycle_status}</p> : <p className="mt-1 text-[11px] text-[#9AABB7]">No result generated</p>}</div>{item.result_id && <AssessmentResultDecisionControls organisationId={organisationId} resultId={item.result_id} lifecycleStatus={item.lifecycle_status} moderationRequired={event.moderationRequired} canApprove={canApprove}/>}<AssessmentAttemptVoidControl organisationId={organisationId} attemptId={item.attempt_id} attemptStatus={item.attempt_status} eventEndsAt={event.endsAt.toISOString()}/><Link href={`/workspace/organisations/${organisationId}/assessments/attempts/${item.attempt_id}`} className="rounded-full border border-[#CFE1E6] px-4 py-2 text-[10px] font-semibold text-[#087F86] hover:bg-[#F0FAF8]">Open marking sheet</Link></div>)}</div>}
      </section>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Attempt coverage · Result lineage · Governance state</span></footer>
    </div>
  </main>;
}
