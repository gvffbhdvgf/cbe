import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';

const modules = [
  { title: 'Institutions & people', description: 'Organisation records, learner identity and workforce', href: '/workspace/organisations', icon: '◎', tag: 'Foundation', ready: true },
  { title: 'Curriculum intelligence', description: 'KICD editions, pathways and source-linked learning areas', href: '/workspace/curriculum', icon: '⌘', tag: 'Catalogue foundation', ready: true },
  { title: 'Class groups', description: 'Grade and academic-year class registers for authorised institutions', href: '/workspace/organisations', icon: '✳', tag: 'Foundation', ready: true },
  { title: 'Assessment evidence', description: 'Assessment events, marking, moderation and governed results', href: '/workspace/organisations', icon: '↗', tag: 'Operational foundation', ready: true },
  { title: 'Progress & support', description: 'Learner progress, interventions and follow-up', href: '#', icon: '◉', tag: 'Planned' },
  { title: 'Analytics & reporting', description: 'Traceable indicators, cohorts and comparisons', href: '#', icon: '▥', tag: 'Planned' },
];

export default function WorkspacePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Preparing your workspace…</main>}><WorkspaceContent /></Suspense>;
}

async function WorkspaceContent() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  const firstName = data.user.name?.trim().split(/\s+/)[0] || 'there';
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="sticky top-0 z-20 border-b border-[#E3EBF0] bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/"><BrandMark size={39}/></Link><div className="flex items-center gap-4"><span className="hidden text-[11px] text-[#8498A7] sm:inline">Secure institutional workspace</span><span className="grid size-9 place-items-center rounded-full bg-[#E4F8F4] text-xs font-bold text-[#087F86]">{firstName.slice(0,1).toUpperCase()}</span><div className="hidden sm:block"><p className="text-[12px] font-semibold text-[#18364E]">{data.user.name || 'Workspace user'}</p><p className="mt-0.5 text-[10px] text-[#8A9CAB]">Signed in</p></div><SignOutButton /></div></div></header>
    <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="eyebrow">Your workspace</p><h1 className="mt-3 text-[36px] font-semibold tracking-[-.055em] text-[#102B45] sm:text-[42px]">Good to see you, {firstName}.</h1><p className="mt-3 max-w-[640px] text-[13px] leading-7 text-[#718697]">A connected view of the institutions, people and learning evidence you are authorised to work with.</p></div><div className="rounded-xl border border-[#DDE9ED] bg-white px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#8A9CAB]">Environment</p><p className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold text-[#29465D]"><span className="size-1.5 rounded-full bg-[#D9A441]"/> Development workspace</p></div></div>
      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map((item,i)=><Link key={item.title} href={item.href} aria-disabled={!item.ready} className={`group rounded-[20px] border border-[#E1EAF0] bg-white p-6 transition duration-300 ${item.ready?'hover:-translate-y-1 hover:border-[#A6E8DE] hover:shadow-[0_16px_40px_rgba(16,43,69,.07)]':'cursor-default opacity-[.82]'}`}><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-[#EAF9F6] text-xl text-[#087F86]">{item.icon}</span><span className="rounded-full bg-[#F3F7F9] px-2.5 py-1 text-[9px] font-semibold text-[#7B91A1]">{item.tag}</span></div><h2 className="mt-7 text-[15px] font-semibold tracking-[-.02em] text-[#18364E]">{item.title}</h2><p className="mt-2 min-h-10 text-[12px] leading-6 text-[#7A8F9E]">{item.description}</p><div className="mt-6 flex items-center justify-between border-t border-[#EDF2F5] pt-4"><span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#91A3B0]">Capability 0{i+1}</span><span className={`text-sm ${item.ready?'text-[#087F86]':'text-[#AAB9C3]'}`}>{item.ready?'Explore →':'Coming into scope'}</span></div></Link>)}</section>
      <section className="mt-8 grid gap-4 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-[20px] border border-[#DDEBEA] bg-gradient-to-br from-[#EAF9F6] via-white to-[#F7FBFC] p-6 sm:p-7"><p className="eyebrow">A careful beginning</p><h2 className="mt-3 text-[18px] font-semibold tracking-[-.03em] text-[#18364E]">Start with trusted institutional context.</h2><p className="mt-2 max-w-[650px] text-[12px] leading-6 text-[#718697]">No institutional records have been loaded. The development environment uses no live learner information. Data will enter through validated, governed workflows.</p><Link href="/workspace/organisations" className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#087F86]">Review organisation foundation <span>→</span></Link></div><div className="rounded-[20px] border border-[#E1EAF0] bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8A9CAB]">Operating principles</p><ul className="mt-4 space-y-3 text-[11px] text-[#5F788A]"><li className="flex gap-2"><span className="text-[#16B8B0]">✓</span> Scoped access and accountability</li><li className="flex gap-2"><span className="text-[#16B8B0]">✓</span> Evidence with clear provenance</li><li className="flex gap-2"><span className="text-[#16B8B0]">✓</span> Human-led educational decisions</li></ul></div></section>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Sentinel · People, evidence and outcomes</span></footer>
    </div>
  </main>;
}
