import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getLearnerRecordCorrectionOverview, listLearnerCorrectionTargets } from '@/application/learner/record-correction-service';
import { LearnerCorrectionManager } from './correction-manager';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function LearnerCorrectionsPage({ params }: { params: Promise<{ organisationId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading correction workspace…</main>}><LearnerCorrectionsContent params={params}/></Suspense>;
}

async function LearnerCorrectionsContent({ params }: { params: Promise<{ organisationId: string }> }) {
  await connection();
  const { organisationId } = await params;
  if (!uuidPattern.test(organisationId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let targets: Awaited<ReturnType<typeof listLearnerCorrectionTargets>>;
  let overview: Awaited<ReturnType<typeof getLearnerRecordCorrectionOverview>>;
  try {
    [targets, overview] = await Promise.all([
      listLearnerCorrectionTargets(data.user.id, organisationId),
      getLearnerRecordCorrectionOverview(data.user.id, organisationId),
    ]);
  } catch { redirect('/workspace/organisations'); }
  const correctionRevision = [
    overview.requests.map(item => `${item.id}:${item.status}:${item.reviewedAt ?? ''}`).join('|'),
    overview.history.map(item => `${item.id}:${item.appliedAt}`).join('|'),
  ].join('::');
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href={`/workspace/organisations/${organisationId}/learners`} className="text-[11px] font-semibold text-[#087F86]">Learner register</Link><Link href={`/workspace/organisations/${organisationId}/staff`} className="text-[11px] font-semibold text-[#087F86]">Staff</Link><Link href="/workspace/organisations" className="text-[11px] font-semibold text-[#087F86]">← Institutions</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace/organisations" className="hover:text-[#087F86]">Institutions</Link> / <Link href={`/workspace/organisations/${organisationId}/learners`} className="hover:text-[#087F86]">Learners</Link> / <span className="text-[#4F6B7E]">Record corrections</span></div>
      <div className="mt-8 max-w-[860px]"><p className="eyebrow">Learner data governance</p><h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45]">Record corrections</h1><p className="mt-3 text-[13px] leading-7 text-[#718697]">Correct inaccurate identity details through a reasoned request, independent review and preserved history. The original record remains in force until approval.</p></div>
      <LearnerCorrectionManager key={correctionRevision} organisationId={organisationId} actorUserId={data.user.id} initialTargets={targets} initialRequests={overview.requests} initialHistory={overview.history}/>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Independent review · Preserved values · Tenant-scoped audit</span></footer>
    </div>
  </main>;
}
