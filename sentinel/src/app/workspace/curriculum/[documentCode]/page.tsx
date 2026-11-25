import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/server';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';
import { SignOutButton } from '@/components/sign-out-button';
import { getCurriculumDocument } from '@/application/curriculum/catalogue-service';
import type { CurriculumOutlineNode } from '@/domain/curriculum/outline';

export default function CurriculumDocumentPage({ params }: { params: Promise<{ documentCode: string }> }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#F4F8FA] p-10 text-sm text-[#667D91]">Loading curriculum design…</main>}>
    <CurriculumDocumentContent params={params} />
  </Suspense>;
}
async function CurriculumDocumentContent({ params }: { params: Promise<{ documentCode: string }> }) {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) redirect('/auth/sign-in');
  const { documentCode } = await params;
  const result = await getCurriculumDocument(documentCode);
  if (!result) notFound();
  const { document, outline } = result;
  const headingCount = outline.reduce((total, node) => total + countNodes(node), 0);
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10 lg:px-14"><Link href="/workspace"><BrandMark size={38}/></Link><div className="flex items-center gap-4"><Link href="/workspace/curriculum" className="text-[11px] font-semibold text-[#087F86]">← Curriculum catalogue</Link><SignOutButton/></div></div></header>
    <div className="mx-auto max-w-[1100px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="text-[10px] font-medium text-[#8A9CAB]"><Link href="/workspace" className="hover:text-[#087F86]">Workspace</Link> / <Link href="/workspace/curriculum" className="hover:text-[#087F86]">Curriculum intelligence</Link> / <span className="text-[#4F6B7E]">{document.areaName}</span></div>
      <div className="mt-8 max-w-[850px]"><p className="eyebrow">Grade {document.grade} · {document.pathwayName} pathway · {document.editionTitle}</p><h1 className="mt-3 text-[34px] font-semibold tracking-[-.05em] text-[#102B45]">{document.areaName}</h1><p className="mt-3 text-[13px] leading-7 text-[#718697]">{document.title}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold"><span className="rounded-full bg-[#F0F4F7] px-3 py-1.5 text-[#637D8F]">{document.publicationLabel ?? 'Publication details pending'}</span><span className="rounded-full bg-[#FFF5E8] px-3 py-1.5 text-[#94621F]">Review: {document.reviewStatus.replaceAll('_',' ')}</span><span className="rounded-full bg-[#FFF5E8] px-3 py-1.5 text-[#94621F]">Rights: {document.rightsStatus.replaceAll('_',' ')}</span><span className="rounded-full bg-[#F0F4F7] px-3 py-1.5 text-[#637D8F]">{headingCount} indexed headings</span></div>
      </div>
      <section className="mt-9 rounded-[20px] border border-[#E1EAF0] bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Source structure</p><h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Strands and sub-strands</h2><p className="mt-2 max-w-[700px] text-[11px] leading-6 text-[#718697]">This view contains indexed headings only. It does not imply that learning outcomes, learning experiences or rubrics have been extracted or approved.</p></div><a href={document.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-[#087F86] hover:underline">Open official KICD source ↗</a></div>
        {outline.length ? <div className="mt-6 space-y-4">{outline.map((node) => <OutlineNode key={node.id} node={node} depth={0}/>)}</div> : <p className="mt-6 rounded-xl bg-[#F5F8FA] p-5 text-[11px] text-[#718697]">No structural headings have been indexed for this document yet.</p>}
      </section>
      <section className="mt-6 rounded-[20px] border border-[#F0E4D2] bg-[#FFFCF7] p-6 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#94621F]">Review boundary</p><p className="mt-2 text-[11px] leading-6 text-[#806F59]">{document.notes ?? 'This document remains a source candidate pending curriculum and rights review.'}</p><p className="mt-3 text-[10px] text-[#9A866B]">Source authority: {document.sourceAuthority.replaceAll('_',' ')} · Edition status: {document.editionStatus}</p></section>
      <footer className="mt-12 flex items-center justify-between border-t border-[#E1EAF0] pt-5"><SoftflixSignature/><span className="text-[10px] text-[#9AABB7]">KICD source provenance · Versioned curriculum</span></footer>
    </div>
  </main>;
}
function countNodes(node: CurriculumOutlineNode): number { return 1 + node.children.reduce((total, child) => total + countNodes(child), 0); }
function OutlineNode({ node, depth }: { node: CurriculumOutlineNode; depth: number }) {
  const isStrand = node.nodeType === 'strand';
  return <article className={isStrand ? 'rounded-xl border border-[#DDE8EE] bg-[#F8FBFC] p-4 sm:p-5' : 'rounded-lg border border-[#EDF1F4] bg-white p-3 sm:p-4'}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="rounded-md bg-[#EAF2F5] px-2 py-1 text-[10px] font-bold text-[#4F6B7E]">{node.nodeCode}</span><div><h3 className={isStrand ? 'text-[13px] font-semibold text-[#18364E]' : 'text-[11px] font-semibold text-[#35536A]'}>{node.title}</h3><p className="mt-1 text-[9px] text-[#91A3B0]">{node.nodeType.replaceAll('_',' ')} · {node.extractionStatus.replaceAll('_',' ')}</p></div></div>{node.sourcePage !== null && <span className="text-[9px] text-[#91A3B0]">Source page {node.sourcePage}</span>}</div>
    {node.notes && <p className="mt-2 text-[10px] leading-5 text-[#8295A3]">{node.notes}</p>}
    {node.children.length > 0 && <div className={depth === 0 ? 'mt-4 space-y-2 border-l-2 border-[#DDE8EE] pl-3 sm:pl-4' : 'mt-3 space-y-2 border-l border-[#E7EDF1] pl-3'}>{node.children.map((child) => <OutlineNode key={child.id} node={child} depth={depth + 1}/>)}</div>}
  </article>;
}
