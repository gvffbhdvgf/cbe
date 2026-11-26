import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getTeacherAssignmentManagementSummary } from '@/application/organisation/teacher-assignment-service';
import { TeachingAssignmentManager } from './teaching-assignment-manager';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function TeachingAssignmentsPage({ params }: { params: Promise<{ organisationId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading teaching assignments…</main>}><TeachingAssignmentsContent params={params}/></Suspense>;
}

async function TeachingAssignmentsContent({ params }: { params: Promise<{ organisationId: string }> }) {
  await connection();
  const { organisationId } = await params;
  if (!uuidPattern.test(organisationId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let summary;
  try { summary = await getTeacherAssignmentManagementSummary(data.user.id, organisationId); }
  catch { redirect('/workspace/organisations'); }
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href={'/workspace/organisations/'+organisationId+'/classes'} className="text-[11px] font-semibold text-[#087F86]">Class register</Link><Link href={'/workspace/organisations/'+organisationId+'/staff'} className="text-[11px] font-semibold text-[#087F86]">Staff register</Link><Link href={'/workspace/organisations/'+organisationId+'/members'} className="text-[11px] font-semibold text-[#087F86]">Members</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace/organisations" className="hover:text-[#087F86]">Institutions</Link> / <span className="text-[#4F6B7E]">Teaching assignments</span></div>
      <div className="mt-8 max-w-[820px]"><p className="eyebrow">People and workforce</p><h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45]">{summary.organisation.name}</h1><p className="mt-3 text-[13px] leading-7 text-[#718697]">Define who is responsible for each class and learning area, with clear effective dates and auditable revocation.</p></div>
      <TeachingAssignmentManager organisationId={organisationId} teachers={summary.teachers} classes={summary.classes} learningAreas={summary.learningAreas} assignments={summary.assignments as never}/>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Teacher scope · Effective dates · Audit history</span></footer>
    </div>
  </main>;
}
