import Link from 'next/link';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';

const capabilities = [
  { number: '01', title: 'People & institutions', detail: 'A trusted foundation for school, learner and workforce records.', mark: '◎', tone: 'teal' },
  { number: '02', title: 'Curriculum intelligence', detail: 'Versioned KICD designs, pathways and learning outcomes.', mark: '⌘', tone: 'blue' },
  { number: '03', title: 'Assessment evidence', detail: 'A transparent journey from assessment to approved results.', mark: '↗', tone: 'amber' },
  { number: '04', title: 'Learner support', detail: 'Turn progress evidence into thoughtful, tracked action.', mark: '✳', tone: 'violet' },
];

function Signal({ className = '' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 540 430" className={className} fill="none">
    <defs><linearGradient id="signal" x1="70" y1="50" x2="430" y2="390" gradientUnits="userSpaceOnUse"><stop stopColor="#35D5C2"/><stop offset="1" stopColor="#0A8290"/></linearGradient><linearGradient id="panel" x1="110" y1="80" x2="450" y2="380" gradientUnits="userSpaceOnUse"><stop stopColor="#173B58"/><stop offset="1" stopColor="#0B2238"/></linearGradient></defs>
    <circle cx="272" cy="215" r="172" stroke="#35D5C2" strokeOpacity=".12" strokeDasharray="3 9"/><circle cx="272" cy="215" r="132" stroke="#35D5C2" strokeOpacity=".2"/><circle cx="272" cy="215" r="96" stroke="#35D5C2" strokeOpacity=".16"/>
    <path d="M270 45 414 105v108c0 88-59 144-144 177-85-33-144-89-144-177V105L270 45Z" fill="url(#panel)" stroke="#4CE0CC" strokeOpacity=".5" strokeWidth="1.5"/>
    <path d="M183 169c30-7 59 2 87 26v110c-28-23-57-32-87-26V169Z" fill="url(#signal)"/><path d="M357 169c-30-7-59 2-87 26v110c28-23 57-32 87-26V169Z" fill="#13AFA9"/><path d="M270 194v111" stroke="#DDFCF7" strokeOpacity=".85" strokeWidth="3" strokeLinecap="round"/>
    <path d="m270 111 9 18 20 6-20 7-9 18-9-18-20-7 20-6 9-18Z" fill="#F7B955"/>
    <circle cx="95" cy="158" r="6" fill="#F7B955"/><circle cx="432" cy="280" r="5" fill="#35D5C2"/><circle cx="386" cy="73" r="4" fill="#35D5C2"/>
    <path d="M99 158h46m250 122h-34M386 73h-30" stroke="#35D5C2" strokeOpacity=".6" strokeDasharray="3 5"/>
  </svg>;
}

export default function HomePage() {
  return <main className="min-h-screen overflow-hidden bg-white">
    <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
      <Link href="/" aria-label="Sentinel home" className="focus-ring rounded-xl"><BrandMark size={43}/></Link>
      <nav className="hidden items-center gap-9 text-[13px] font-medium text-[#61788B] md:flex"><a href="#platform" className="transition hover:text-[#087F86]">Platform</a><a href="#approach" className="transition hover:text-[#087F86]">Our approach</a><a href="#company" className="transition hover:text-[#087F86]">About Softflix</a></nav>
      <Link href="/auth/sign-in" className="focus-ring rounded-full bg-[#102B45] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_5px_15px_rgba(16,43,69,.14)] transition hover:-translate-y-0.5 hover:bg-[#174363]">Sign in <span className="ml-2 text-[#35D5C2]">↗</span></Link>
    </header>

    <section className="relative isolate overflow-hidden bg-[#0B2035] text-white">
      <div className="hero-grid absolute inset-0 opacity-60"/><div className="hero-orb absolute -right-40 -top-28 size-[650px] rounded-full"/><div className="absolute -bottom-64 -left-40 size-[600px] rounded-full bg-[#0C5B65]/20 blur-[100px]"/>
      <div className="relative mx-auto grid min-h-[660px] max-w-[1440px] items-center gap-4 px-6 py-20 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:px-16 lg:py-24">
        <div className="fade-up relative z-10 max-w-[650px]">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3.5 py-2 text-[11px] font-semibold tracking-[.13em] text-[#9DEDE2]"><span className="size-1.5 rounded-full bg-[#35D5C2] shadow-[0_0_12px_#35D5C2]"/> EDUCATION OPERATIONS & INTELLIGENCE</div>
          <h1 className="max-w-[660px] text-[clamp(3.2rem,6.2vw,5.8rem)] font-semibold leading-[.99] tracking-[-.065em]">See the whole picture. <span className="bg-gradient-to-r from-[#8AF0DF] via-[#35D5C2] to-[#75B9E9] bg-clip-text text-transparent">Support every possibility.</span></h1>
          <p className="mt-8 max-w-[530px] text-[16px] leading-8 text-[#A9BDCC] sm:text-[17px]">A connected, evidence-led education platform bringing institutions, curriculum, assessment and learner support into one accountable workspace.</p>
          <div className="mt-10 flex flex-wrap items-center gap-4"><Link href="/auth/sign-in" className="focus-ring inline-flex items-center gap-4 rounded-full bg-[#35D5C2] px-6 py-3.5 text-[13px] font-bold text-[#082B37] shadow-[0_8px_28px_rgba(53,213,194,.2)] transition hover:-translate-y-0.5 hover:bg-[#69E7D7]">Enter Sentinel <span className="text-lg">→</span></Link><span className="text-xs leading-5 text-[#7F98AA]">Built for Kenya’s Grades 1–9 learning continuum</span></div>
          <div className="mt-16 flex items-center gap-3"><span className="h-px w-10 bg-[#35D5C2]/70"/><span className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#8FA7B7]">People · Evidence · Outcomes</span></div>
        </div>
        <div className="relative mx-auto flex w-full max-w-[600px] items-center justify-center lg:translate-x-7">
          <Signal className="float-gentle relative z-10 w-full max-w-[540px] drop-shadow-[0_28px_55px_rgba(0,0,0,.22)]"/>
          <div className="absolute left-0 top-[19%] rounded-2xl border border-white/10 bg-[#15364D]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:left-1"><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#91B3C3]">Connected records</p><p className="mt-1.5 text-sm font-semibold text-white">One trusted picture</p></div>
          <div className="absolute bottom-[13%] right-0 rounded-2xl border border-white/10 bg-[#15364D]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:right-1"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[#35D5C2]/15 text-[#6DE6D7]">✳</span><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#91B3C3]">Designed around</p><p className="mt-0.5 text-sm font-semibold text-white">Learner potential</p></div></div></div>
        </div>
      </div>
      <div className="relative mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-6 py-5 sm:px-10 lg:px-16"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#7893A5]">A thoughtful operating system for education</p><p className="text-[11px] text-[#7893A5]">01 — 09 <span className="mx-2 text-[#35D5C2]">/</span> Lower primary to junior school</p></div>
    </section>

    <section id="platform" className="mx-auto max-w-[1440px] px-6 py-24 sm:px-10 lg:px-16 lg:py-28">
      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="eyebrow">One connected platform</p><h2 className="mt-5 max-w-[460px] text-4xl font-semibold leading-[1.08] tracking-[-.05em] text-[#102B45] sm:text-5xl">The right context for better decisions.</h2></div><p className="max-w-[570px] pb-1 text-[15px] leading-8 text-[#6A8092]">Education is a connected journey. Sentinel brings the operational record and learning evidence together, while keeping accountability, provenance and the people behind every decision in view.</p></div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{capabilities.map(item=><article key={item.number} className="group rounded-[22px] border border-[#E4ECF1] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#A6E8DE] hover:shadow-[0_18px_45px_rgba(16,43,69,.08)]"><div className="flex items-start justify-between"><span className="text-[11px] font-bold tracking-[.16em] text-[#8DA1B1]">{item.number}</span><span className="grid size-11 place-items-center rounded-2xl bg-[#E9FAF7] text-xl text-[#087F86] transition group-hover:bg-[#D5F7F0]">{item.mark}</span></div><h3 className="mt-9 text-[17px] font-semibold tracking-[-.025em] text-[#102B45]">{item.title}</h3><p className="mt-3 text-[13px] leading-6 text-[#74899A]">{item.detail}</p><div className="mt-7 h-px w-full bg-[#E9EFF3]"/><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-[#0A8588]">Explore capability <span className="ml-1">↗</span></p></article>)}</div>
    </section>

    <section id="approach" className="border-y border-[#E5EDF2] bg-[#F4F8FA]">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:items-center lg:px-16 lg:py-24">
        <div><p className="eyebrow">Evidence with purpose</p><h2 className="mt-5 max-w-[500px] text-4xl font-semibold leading-[1.08] tracking-[-.05em] text-[#102B45] sm:text-5xl">From information to meaningful action.</h2><p className="mt-6 max-w-[500px] text-[14px] leading-7 text-[#6A8092]">Capture the context behind the numbers. Preserve where evidence came from. Give educators the tools to understand progress and follow through with care.</p></div>
        <div className="rounded-[26px] border border-[#E1EAF0] bg-white p-7 shadow-[0_20px_55px_rgba(16,43,69,.055)] sm:p-9"><div className="flex items-center justify-between border-b border-[#EAF0F4] pb-5"><div><p className="text-[12px] font-semibold text-[#102B45]">A connected evidence cycle</p><p className="mt-1 text-[11px] text-[#8A9CAB]">A transparent, human-led workflow</p></div><span className="rounded-full bg-[#E9FAF7] px-3 py-1.5 text-[10px] font-bold text-[#087F86]">Accountable by design</span></div><div className="mt-7 space-y-5">{[['01','Understand','People, institutions and learning context'],['02','Capture','Curriculum-aligned evidence and assessment'],['03','Review','Moderation, provenance and informed decisions'],['04','Support','Interventions, follow-up and reflection']].map(([n,title,detail],i)=><div key={n} className="flex items-center gap-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${i===3?'bg-[#102B45] text-white':'bg-[#E9FAF7] text-[#087F86]'}`}>{n}</span><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-[#18364E]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#8295A4]">{detail}</p></div><span className="text-[#A8BAC6]">→</span></div>)}</div></div>
      </div>
    </section>

    <footer id="company" className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-9 sm:px-10 md:flex-row md:items-center md:justify-between lg:px-16"><div className="flex items-center gap-4"><BrandMark size={34}/><span className="h-7 w-px bg-[#E1EAF0]"/><SoftflixSignature/></div><p className="text-[11px] text-[#8A9CAB]">© 2026 Softflix. Sentinel is built around people, evidence and outcomes.</p><Link href="/auth/sign-in" className="text-[12px] font-semibold text-[#087F86] hover:text-[#102B45]">Secure workspace ↗</Link></footer>
  </main>;
}
