import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getAssessmentAuthoringOptions, listAssessmentEvents } from '@/application/assessment/assessment-service';
import { getOrganisationActorRole } from '@/application/organisation/membership-service';
import { AssessmentEventControls } from './event-controls';
import { AssessmentAuthoringControls } from './authoring-controls';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AssessmentEventsPage({ params }: { params: Promise<{ organisationId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading assessment workspace…</main>}><AssessmentEventsContent params={params}/></Suspense>;
}

async function AssessmentEventsContent({ params }: { params: Promise<{ organisationId: string }> }) {
  await connection();
  const { organisationId } = await params;
  if (!uuidPattern.test(organisationId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let events: Awaited<ReturnType<typeof listAssessmentEvents>>;
  let authoring: Awaited<ReturnType<typeof getAssessmentAuthoringOptions>> | null = null;
  let actorRole: string | null = null;
  try {
    actorRole = await getOrganisationActorRole(data.user.id, organisationId);
    events = await listAssessmentEvents(data.user.id, organisationId);
    if (actorRole !== 'teacher') authoring = await getAssessmentAuthoringOptions(data.user.id, organisationId);
  } catch { redirect('/workspace/organisations'); }

  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href="/workspace/organisations" className="text-[11px] font-semibold text-[#087F86]">← Institutions</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace/organisations" className="hover:text-[#087F86]">Institutions</Link> / <span className="text-[#4F6B7E]">Assessment evidence</span></div>
      <div className="mt-8 max-w-[820px]"><p className="eyebrow">Assessment evidence</p><h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45]">Assessment events</h1><p className="mt-3 text-[13px] leading-7 text-[#718697]">Review assessment events. Teachers see only events for their assigned classes and learning areas; authoring, scheduling and result governance remain with authorised assessment officers and organisation administrators.</p></div>
      {authoring && <AssessmentAuthoringControls organisationId={organisationId} actorUserId={data.user.id} programmes={authoring.programmes} instruments={authoring.instruments} learningAreas={authoring.learningAreas} gradeOfferings={authoring.gradeOfferings} classes={authoring.classes} timeZone={authoring.timeZone}/ >}
      <section className="mt-9 space-y-3">
        {events.length === 0 ? <div className="rounded-[18px] border border-dashed border-[#CAD9E2] bg-white px-6 py-12"><p className="text-[14px] font-semibold text-[#29465D]">No assigned assessment events yet</p><p className="mt-2 max-w-[540px] text-[12px] leading-6 text-[#7C91A0]">The event register is ready for governed assessment records. Event and instrument authoring will be enabled after the creation workflow is completed.</p></div> : events.map(event => <article key={event.id} className="rounded-[18px] border border-[#E1EAF0] bg-white p-5 transition hover:border-[#A6E8DE] hover:shadow-[0_12px_30px_rgba(16,43,69,.05)]"><Link href={`/workspace/organisations/${organisationId}/assessments/events/${event.id}`} className="block"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#8A9CAB]">Grade {event.grade} · {event.academicYear}</p><h2 className="mt-2 text-[17px] font-semibold text-[#18364E]">{event.title}</h2><p className="mt-1 text-[12px] text-[#718697]">{event.learningArea} · {event.programme} · {event.instrumentCode} v{event.instrumentVersion}{event.className ? ' · '+event.className : ' · All classes'}</p><p className="mt-2 text-[10px] text-[#8A9CAB]">{event.startsAt.toLocaleString('en-KE', { timeZone: event.timeZone, dateStyle: 'medium', timeStyle: 'short' })} – {event.endsAt.toLocaleString('en-KE', { timeZone: event.timeZone, dateStyle: 'medium', timeStyle: 'short' })} · {event.timeZone}</p></div><span className="rounded-full bg-[#EAF5F4] px-3 py-1.5 text-[10px] font-semibold capitalize text-[#087F86]">{event.status}</span></div></Link>{actorRole !== 'teacher' && <AssessmentEventControls organisationId={organisationId} eventId={event.id} status={event.status}/>}</article>)}
      </section>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Frozen eligibility · Append-only evidence · Governed results</span></footer>
    </div>
  </main>;
}
