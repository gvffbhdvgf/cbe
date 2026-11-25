import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-12">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#155eef] text-lg font-bold text-white">S</div><span className="text-lg font-semibold tracking-tight">Sentinel</span></div>
        <Link href="/auth/sign-in" className="rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">Sign in</Link>
      </header>
      <section className="mx-auto grid min-h-[75vh] max-w-7xl items-center gap-12 py-20 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.2em] text-[#155eef]">Education operations & intelligence</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight md:text-6xl">A clearer picture of every learner’s journey.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#667085]">Connect school operations, curriculum, assessment evidence and learner support in one accountable workspace.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link href="/auth/sign-in" className="rounded-lg bg-[#155eef] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1849a9]">Open Sentinel</Link><span className="self-center text-sm text-[#667085]">Designed for Kenya’s Grades 1–9 learning continuum</span></div>
        </div>
        <div className="rounded-3xl border border-[#e4e7ec] bg-white p-5 shadow-sm md:p-7">
          <div className="flex items-center justify-between border-b border-[#e4e7ec] pb-4"><div><p className="text-sm font-semibold">Education workspace</p><p className="mt-1 text-xs text-[#667085]">A connected operating picture</p></div><span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-medium text-[#027a48]">Evidence-led</span></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[['01','People & institutions','Identity, enrolment and workforce'],['02','Curriculum intelligence','KICD designs and learning outcomes'],['03','Assessment evidence','Capture, moderation and publication'],['04','Learner support','Progress, interventions and follow-up']].map(([n,title,description]) => <div key={n} className="rounded-2xl bg-[#f8fafc] p-4"><span className="text-xs font-semibold text-[#155eef]">{n}</span><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-[#667085]">{description}</p></div>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-[#667085]">Institutional data is protected by scoped access, provenance and auditable workflows.</p>
        </div>
      </section>
      <footer className="mx-auto max-w-7xl border-t border-[#e4e7ec] py-5 text-xs text-[#667085]">Sentinel · Secure by design · Built around people, evidence and outcomes</footer>
    </main>
  );
}
