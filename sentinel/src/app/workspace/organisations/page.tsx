import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { connection } from 'next/server';

export default function OrganisationsPage() {
  return <Suspense fallback={<main className="min-h-screen p-10 text-sm text-[#667085]">Loading directory…</main>}><OrganisationsContent /></Suspense>;
}

async function OrganisationsContent() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  return <main className="min-h-screen"><header className="border-b border-[#e4e7ec] bg-white"><div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4"><Link href="/workspace" className="text-sm font-medium text-[#155eef]">← Workspace</Link><span className="text-sm text-[#98a2b3]">/</span><span className="text-sm font-semibold">Institutions & people</span></div></header><div className="mx-auto max-w-7xl px-6 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#155eef]">Organisation context</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Institutions & organisations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">A governed directory for institutions and the relationships that connect them. Records will be added only after their legal owner, authority scope and source identifiers are established.</p><section className="mt-8 rounded-2xl border border-dashed border-[#d0d5dd] bg-white p-8"><div className="mx-auto max-w-lg text-center"><div className="mx-auto grid size-12 place-items-center rounded-xl bg-[#eff4ff] text-xl text-[#155eef]">⌂</div><h2 className="mt-4 text-lg font-semibold">No institutions registered yet</h2><p className="mt-2 text-sm leading-6 text-[#667085]">The directory is ready for its first validated source. We have not inserted sample schools or guessed Kenya’s administrative hierarchy.</p><p className="mt-5 text-xs font-medium text-[#667085]">Next: confirm institutional authority and import source → review → approve.</p></div></section></div></main>;
}
