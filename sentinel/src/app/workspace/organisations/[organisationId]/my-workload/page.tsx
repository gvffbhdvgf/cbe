import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getMyTeacherWorkloadSummary } from '@/application/organisation/teacher-assignment-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function MyTeachingWorkloadPage({ params, searchParams }: { params: Promise<{ organisationId: string }>; searchParams: Promise<{ academicYear?: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading your workload…</main>}><MyTeachingWorkloadContent params={params} searchParams={searchParams}/></Suspense>;
}

async function MyTeachingWorkloadContent({ params, searchParams }: { params: Promise<{ organisationId: string }>; searchParams: Promise<{ academicYear?: string }> }) {
  await connection();
  const { organisationId } = await params;
  const query = await searchParams;
  if (!uuidPattern.test(organisationId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  const academicYear = Number(query.academicYear || new Date().getFullYear());
  let summary;
  try { summary = await getMyTeacherWorkloadSummary(data.user.id, organisationId, academicYear); }
  catch { notFound(); }
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href={'/workspace/organisations/'+organisationId+'/teaching'} className="text-[11px] font-semibold text-[#087F86]">Teaching assignments</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1000px] px-6 py-10 sm:py-14">
      <p className="eyebrow">My teaching</p><h1 className="mt-3 text-[32px] font-semibold tracking-[-.05em] text-[#102B45]">Weekly workload</h1>
      <p className="mt-2 text-[12px] text-[#718697]">{summary.organisation.name} · Academic year {summary.academicYear} · As of {summary.asOfDate}</p>
      <section className="mt-7 rounded-[20px] border border-[#DCE8EC] bg-white p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]">Allocated weekly teaching periods</p><p className="mt-2 text-[36px] font-semibold text-[#102B45]">{summary.totalWeeklyPeriods}</p>
        <p className="mt-2 text-[11px] text-[#718697]">{summary.policy ? 'Reference: '+summary.policy.referenceWeeklyPeriods+' · Maximum: '+summary.policy.maximumWeeklyPeriods+' periods per week' : 'No institution workload thresholds are configured for this date.'}</p>
        {summary.policy&&<p className="mt-2 text-[11px] font-medium text-[#526B7E]">{summary.totalWeeklyPeriods>summary.policy.maximumWeeklyPeriods?'Above the configured maximum':summary.totalWeeklyPeriods>summary.policy.referenceWeeklyPeriods?'Above the configured reference':'Within the configured reference'}</p>}
      </section>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
        <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">My class and learning-area allocations</h2></div>
        {summary.assignments.length===0?<p className="px-5 py-8 text-[12px] text-[#8498A7]">No active teaching assignments are recorded for this academic year.</p>:<div className="divide-y divide-[#E8EEF2]">{summary.assignments.map(item=><div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-[12px] font-semibold text-[#29465D]">{item.learningArea}</p><p className="mt-1 text-[10px] text-[#718697]">Grade {item.grade} · {item.startsOn} to {item.endsOn??'open-ended'}</p></div><p className="text-[14px] font-semibold text-[#102B45]">{item.weeklyPeriods??'—'} <span className="text-[10px] font-normal text-[#718697]">periods/week</span></p></div>)}</div>}
      </section>
      <footer className="mt-12 border-t border-[#E1EAF0] pt-5"><SoftflixSignature/></footer>
    </div>
  </main>;
}