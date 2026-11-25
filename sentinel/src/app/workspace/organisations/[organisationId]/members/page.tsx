import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getOrganisationManagementSummary } from '@/application/organisation/membership-service';
import { MembershipManager } from './membership-manager';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function OrganisationMembersPage({ params }: { params: Promise<{ organisationId: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading membership directory…</main>}><OrganisationMembersContent params={params}/></Suspense>;
}

async function OrganisationMembersContent({ params }: { params: Promise<{ organisationId: string }> }) {
  await connection();
  const { organisationId } = await params;
  if (!uuidPattern.test(organisationId)) notFound();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  let summary;
  try { summary = await getOrganisationManagementSummary(data.user.id, organisationId); }
  catch { redirect('/workspace/organisations'); }

  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href="/workspace/organisations" className="text-[11px] font-semibold text-[#087F86]">← Institutions</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1100px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace/organisations" className="hover:text-[#087F86]">Institutions</Link> / <span className="text-[#4F6B7E]">Members</span></div>
      <p className="eyebrow mt-8">Organisation access</p>
      <h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45]">{summary.organisation.name}</h1>
      <p className="mt-3 max-w-[680px] text-[13px] leading-7 text-[#718697]">Manage the people and roles attached to this organisation. Access changes are effective immediately and recorded in the audit trail.</p>
      <MembershipManager organisationId={organisationId} actorRole={summary.actorRole} initialMembers={summary.members.map(member=>({...member,startsAt:member.startsAt.toISOString(),endsAt:member.endsAt?.toISOString()??null}))}/>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Least privilege · Effective-dated access · Audit trail</span></footer>
    </div>
  </main>;
}
