import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth/server';
import Link from 'next/link';
import { Suspense } from 'react';

const modules = [
  ['Institutions & people','Organisation records, learner identity and workforce','/workspace/organisations'],
  ['Curriculum','KICD editions, pathways, learning areas and outcomes','#'],
  ['Teaching & learning','Class groups, allocations and learning activities','#'],
  ['Assessment','Instruments, marking, moderation and results','#'],
  ['Progress & support','Learner progress, interventions and follow-up','#'],
  ['Analytics & reporting','Traceable indicators, cohorts and comparisons','#'],
];

export default function WorkspacePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f7f8fa] p-10 text-sm text-[#667085]">Loading your workspace…</main>}><WorkspaceContent /></Suspense>;
}

async function WorkspaceContent() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  return <main className="min-h-screen"><header className="border-b border-[#e4e7ec] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><Link href="/" className="flex items-center gap-3 font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-[#155eef] text-white">S</span>Sentinel</Link><div className="text-right"><p className="text-sm font-medium">{data.user.name || 'Workspace user'}</p><p className="text-xs text-[#667085]">Signed in</p></div></div></header><div className="mx-auto max-w-7xl px-6 py-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#155eef]">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Good to see you</h1><p className="mt-2 text-sm text-[#667085]">Your work begins with trusted institutional records and connected learning evidence.</p><section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map(([title,description,href],i)=><Link key={title} href={href} className="group rounded-2xl border border-[#e4e7ec] bg-white p-5 transition hover:border-[#b2ccff] hover:shadow-sm"><span className="text-xs font-semibold text-[#155eef]">0{i+1}</span><h2 className="mt-5 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667085]">{description}</p><p className="mt-5 text-sm font-medium text-[#155eef]">{href === '#' ? 'Planned module' : 'Open directory'} <span aria-hidden="true">→</span></p></Link>)}</section><p className="mt-8 rounded-xl border border-dashed border-[#d0d5dd] bg-white p-5 text-sm leading-6 text-[#667085]">No institutional records have been loaded. Sentinel is currently configured for development with synthetic data only. No learner information is displayed here.</p></div></main>;
}
