'use client';

import Link from 'next/link';

type Result = {
  eventTitle: string; learningArea: string; grade: number; academicYear: number;
  percentage: number | string; performanceLevel: string | null; publishedAt: string | null;
};
type Learner = {
  relationship_id: string; organisation_name: string; learner_reference: string; learner_name: string;
  relationship_type: string; grade: number | null; academic_year: number | null;
  can_view_progress: boolean; can_receive_messages: boolean; published_progress: Result[];
};

const titleCase = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeZone:'Africa/Nairobi'}).format(new Date(value)) : '—';

export function GuardianPortal({ learners }: { learners: Learner[] }) {
  return <main className="min-h-screen bg-[#F4F8FA]">
    <header className="border-b border-[#E3EBF0] bg-white"><div className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-4 sm:px-10"><Link href="/"><span className="text-[15px] font-semibold tracking-[-.04em] text-[#102B45]">Sentinel</span></Link><Link href="/auth/sign-in" className="text-[11px] font-semibold text-[#087F86]">Sign in</Link></div></header>
    <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10 lg:py-14">
      <p className="eyebrow">Family access</p><h1 className="mt-3 text-[34px] font-semibold tracking-[-.05em] text-[#102B45]">Learner connections.</h1>
      <p className="mt-3 max-w-[700px] text-[13px] leading-7 text-[#718697]">This view shows only learners whose identity and relationship have been independently verified by their institution. Published progress appears only when the institution has granted that permission.</p>
      {learners.length===0?<section className="mt-8 rounded-[20px] border border-[#DCE8EC] bg-white p-7 sm:p-9"><p className="text-[13px] font-semibold text-[#29465D]">No verified learner relationships yet</p><p className="mt-2 max-w-[650px] text-[12px] leading-6 text-[#718697]">Your account is not currently linked to an active, verified learner relationship. Contact the learner’s institution and ask its authorised staff to confirm your identity and relationship. No learner records are visible until that review is complete.</p></section>:<div className="mt-8 space-y-5">{learners.map(learner=><article key={learner.relationship_id} className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#8296A5]">{learner.organisation_name}</p><h2 className="mt-2 text-[19px] font-semibold text-[#18364E]">{learner.learner_name}</h2><p className="mt-1 text-[10px] text-[#8296A5]">{learner.learner_reference} · {titleCase(learner.relationship_type)}</p></div><div className="rounded-full bg-[#EAF7F5] px-3 py-1.5 text-[9px] font-semibold text-[#28736D]">Verified relationship</div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#F6F9FA] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#8296A5]">Current grade</p><p className="mt-1.5 text-[13px] font-semibold text-[#29465D]">{learner.grade===null?'Not enrolled':'Grade '+learner.grade}</p></div><div className="rounded-xl bg-[#F6F9FA] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#8296A5]">Academic year</p><p className="mt-1.5 text-[13px] font-semibold text-[#29465D]">{learner.academic_year??'—'}</p></div><div className="rounded-xl bg-[#F6F9FA] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#8296A5]">Access permissions</p><p className="mt-1.5 text-[11px] font-semibold text-[#29465D]">{learner.can_view_progress?'Published progress':'No progress access'} · {learner.can_receive_messages?'Messages enabled':'No messages'}</p></div></div>
        {learner.can_view_progress&&<section className="mt-6"><div className="flex items-center justify-between gap-3"><h3 className="text-[12px] font-semibold text-[#29465D]">Published learning progress</h3><span className="text-[9px] text-[#8296A5]">Institution-approved results only</span></div>{learner.published_progress.length===0?<p className="mt-3 rounded-xl bg-[#FBFDFD] p-4 text-[11px] text-[#8296A5]">No published assessment results are available yet.</p>:<div className="mt-3 space-y-2">{learner.published_progress.map((result,index)=><div key={result.eventTitle+'-'+result.learningArea+'-'+index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAF0F3] p-3"><div><p className="text-[11px] font-semibold text-[#35556B]">{result.eventTitle}</p><p className="mt-1 text-[10px] text-[#8296A5]">{result.learningArea} · Grade {result.grade} · {result.academicYear} · Published {formatDate(result.publishedAt)}</p></div><div className="text-right"><p className="text-[16px] font-semibold tabular-nums text-[#087F86]">{Number(result.percentage).toFixed(1)}%</p>{result.performanceLevel&&<p className="mt-0.5 text-[9px] text-[#8296A5]">{titleCase(result.performanceLevel)}</p>}</div></div>)}</div>}</section>}
        {!learner.can_view_progress&&<p className="mt-5 rounded-xl bg-[#FBFDFD] p-4 text-[11px] leading-5 text-[#8296A5]">The institution has not granted progress-view permission for this relationship. Contact the institution if you believe this is incorrect.</p>}
      </article>)}</div>}
      <footer className="mt-12 border-t border-[#E1EAF0] pt-5 text-[10px] text-[#9AABB7]">Sentinel · Family access is limited to independently verified relationships and explicit institution permissions.</footer>
    </div>
  </main>;
}
