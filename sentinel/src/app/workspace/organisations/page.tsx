import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { isPlatformAdministrator, listAccessibleOrganisations } from '@/application/organisation/organisation-service';
import { OrganisationOnboardingForm } from './onboarding-form';
import { SignOutButton } from '@/components/sign-out-button';

export default function OrganisationsPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading directory…</main>}><OrganisationsContent /></Suspense>;
}

async function OrganisationsContent() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  const [organisations, canOnboard] = await Promise.all([
    listAccessibleOrganisations(data.user.id),
    isPlatformAdministrator(data.user.id),
  ]);

  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href="/workspace" className="text-[11px] font-semibold text-[#087F86]">← Workspace</Link><SignOutButton /></div></div></header>
    <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace" className="hover:text-[#087F86]">Workspace</Link><span>/</span><span className="text-[#4F6B7E]">Institutions & people</span></div>
      <div className="mt-8 max-w-[760px]"><p className="eyebrow">Organisation context</p><h1 className="mt-3 text-[38px] font-semibold tracking-[-.055em] text-[#102B45]">Institutions & organisations</h1><p className="mt-4 text-[13px] leading-7 text-[#718697]">A governed directory for institutions and the relationships that connect them. You see only organisations where you hold an active, time-valid membership.</p></div>
      <section className="mt-10 overflow-hidden rounded-[22px] border border-[#E1EAF0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F4] px-6 py-5"><div><h2 className="text-[13px] font-semibold text-[#29465D]">Your institution directory</h2><p className="mt-1 text-[10px] text-[#91A3B0]">Membership-scoped institutional records</p></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{organisations.length} {organisations.length === 1 ? 'record' : 'records'}</span></div>
        {organisations.length ? <div className="divide-y divide-[#EDF2F5]">{organisations.map((organisation)=><div key={organisation.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"><div><h3 className="text-[13px] font-semibold text-[#18364E]">{organisation.name}</h3><p className="mt-1 text-[10px] text-[#8195A4]">Role: {organisation.role.replaceAll('_',' ')} · {organisation.status}</p>{['organisation_admin','school_admin'].includes(organisation.role) && <div className="mt-2 flex flex-wrap gap-4"><Link href={`/workspace/organisations/${organisation.id}/members`} className="inline-flex text-[10px] font-bold text-[#087F86] hover:underline">Manage members →</Link><Link href={`/workspace/organisations/${organisation.id}/learners`} className="inline-flex text-[10px] font-bold text-[#087F86] hover:underline">Learner register →</Link><Link href={`/workspace/organisations/${organisation.id}/classes`} className="inline-flex text-[10px] font-bold text-[#087F86] hover:underline">Manage classes →</Link></div>}</div><span className="rounded-full bg-[#EAF9F6] px-3 py-1.5 text-[10px] font-semibold text-[#087F86]">Active access</span></div>)}</div> : <div className="px-6 py-16 text-center sm:py-20"><div className="mx-auto grid size-[62px] place-items-center rounded-[20px] bg-[#E9FAF7]"><BrandMark size={42} compact/></div><h3 className="mt-6 text-[18px] font-semibold tracking-[-.03em] text-[#18364E]">No institution access yet.</h3><p className="mx-auto mt-3 max-w-[480px] text-[12px] leading-6 text-[#7A8F9E]">Your account is not currently linked to an active institution. Ask an authorised Sentinel platform administrator to provision your access.</p></div>}
      </section>
      {canOnboard && <section className="mt-6 rounded-[22px] border border-[#DDEBEA] bg-white p-6 sm:p-8"><p className="eyebrow">Platform administration</p><h2 className="mt-2 text-[18px] font-semibold tracking-[-.03em] text-[#18364E]">Register an institution</h2><p className="mt-2 max-w-[620px] text-[12px] leading-6 text-[#718697]">Registration creates an organisation record, grants you organisation-administrator membership and records an audit event. Confirm the institution’s authority and official identifier before submitting.</p><OrganisationOnboardingForm /></section>}
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Governed data · Scoped access · Audit trail</span></footer>
    </div>
  </main>;
}
