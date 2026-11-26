import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getGuardianManagementSummary } from '@/application/organisation/guardian-service';
import { GuardianRegisterManager } from './guardian-register-manager';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function GuardiansPage({ params }: { params: Promise<{ organisationId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading guardian register…</main>}><GuardiansContent params={params}/></Suspense>;
}

async function GuardiansContent({ params }: { params: Promise<{ organisationId: string }> }) {
  await connection();
  const { organisationId } = await params;
  if (!uuidPattern.test(organisationId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let summary;
  try { summary = await getGuardianManagementSummary(data.user.id, organisationId); }
  catch { redirect('/workspace/organisations'); }

  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex flex-wrap items-center gap-4"><Link href={'/workspace/organisations/'+organisationId+'/learners'} className="text-[11px] font-semibold text-[#087F86]">Learner register</Link><Link href={'/workspace/organisations/'+organisationId+'/staff'} className="text-[11px] font-semibold text-[#087F86]">Staff register</Link><Link href={'/workspace/organisations/'+organisationId+'/teaching'} className="text-[11px] font-semibold text-[#087F86]">Teaching</Link><Link href="/workspace/organisations" className="text-[11px] font-semibold text-[#087F86]">Institutions</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace/organisations" className="hover:text-[#087F86]">Institutions</Link> / <span className="text-[#4F6B7E]">Guardian register</span></div>
      <div className="mt-8 max-w-[850px]"><p className="eyebrow">Learner safeguarding</p><h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45]">{summary.organisation.name}</h1><p className="mt-3 text-[13px] leading-7 text-[#718697]">Maintain independently verified guardian identities and learner relationships. Pending, rejected, expired or revoked relationships do not grant access. Permission is assigned per learner relationship, not inferred from names or shared contact details.</p></div>
      <GuardianRegisterManager organisationId={organisationId} initialSummary={summary}/>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Independent verification · Per-learner permissions · Audit history</span></footer>
    </div>
  </main>;
}
