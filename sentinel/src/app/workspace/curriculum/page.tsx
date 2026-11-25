import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { listCurriculumCatalogue } from '@/application/curriculum/catalogue-service';
import { CurriculumBrowser } from './curriculum-browser';

export default function CurriculumPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading curriculum catalogue…</main>}><CurriculumContent /></Suspense>;
}

async function CurriculumContent() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  const catalogue = await listCurriculumCatalogue();
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href="/workspace" className="text-[11px] font-semibold text-[#087F86]">← Workspace</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace" className="hover:text-[#087F86]">Workspace</Link> / <span className="text-[#4F6B7E]">Curriculum intelligence</span></div>
      <div className="mt-8 max-w-[820px]"><p className="eyebrow">KICD curriculum registry</p><h1 className="mt-3 text-[38px] font-semibold tracking-[-.055em] text-[#102B45]">Curriculum intelligence</h1><p className="mt-4 text-[13px] leading-7 text-[#718697]">A version-aware catalogue of official curriculum designs for Grades 1–9. Each learning area retains its KICD source and publication status; unverified or incomplete entries are explicitly flagged rather than silently treated as approved content.</p></div>
      <CurriculumBrowser pathways={catalogue.pathways} offerings={catalogue.offerings}/>
      <section className="mt-8 rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8"><p className="eyebrow">Curriculum design structure</p><h2 className="mt-2 text-[17px] font-semibold text-[#18364E]">Beyond a list of subjects</h2><p className="mt-2 max-w-[900px] text-[12px] leading-6 text-[#718697]">The next ingestion layer will preserve the exact curriculum edition and learning area, then capture strands, sub-strands, general and specific learning outcomes, suggested learning experiences, key inquiry questions, core competencies, values, pertinent and contemporary issues, Community Service Learning and assessment rubrics where present in the source. These structures will not be flattened into a generic subject table.</p></section>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">Official source provenance · Versioned designs · Inclusive pathways</span></footer>
    </div>
  </main>;
}
