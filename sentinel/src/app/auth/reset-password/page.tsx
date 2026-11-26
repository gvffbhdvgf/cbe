'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BrandMark, SoftflixSignature } from '@/components/brand-mark';

export default function ResetPasswordPage() {
  const router=useRouter();
  const [token,setToken]=useState('');
  useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'');},[]);
  const [password,setPassword]=useState(''), [confirm,setConfirm]=useState(''), [error,setError]=useState(''), [done,setDone]=useState(false), [pending,setPending]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if(!token){setError('This password setup link is missing its token. Request a new link.');return;}
    if(password!==confirm){setError('The passwords do not match.');return;}
    if(password.length<8||password.length>128){setError('Use a password between 8 and 128 characters.');return;}
    setPending(true);
    try {
      const response=await fetch('/api/auth/reset-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,newPassword:password})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result?.message||'The setup link is invalid or expired. Request a new one.');
      setDone(true); window.setTimeout(()=>router.replace('/auth/sign-in'),1800);
    } catch(cause){setError(cause instanceof Error?cause.message:'Password setup failed. Request a new link and try again.');}
    finally{setPending(false);}
  }
  return <main className="flex min-h-screen flex-col justify-between bg-white px-6 py-8 sm:px-12 lg:px-16">
    <Link href="/"><BrandMark size={42}/></Link>
    <section className="mx-auto my-auto w-full max-w-[430px] py-12">
      <p className="eyebrow">Secure account setup</p><h1 className="mt-4 text-[36px] font-semibold tracking-[-.05em] text-[#102B45]">Choose a password.</h1>
      <p className="mt-3 text-[14px] leading-7 text-[#718697]">Create a strong password for your Sentinel account. You can change it later from your account settings.</p>
      {done?<p role="status" className="mt-8 rounded-xl border border-[#CDEBE5] bg-[#F2FAF8] p-4 text-[13px] leading-6 text-[#176B62]">Your password has been set. Redirecting you to sign in…</p>:
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">New password</span><input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none focus:border-[#16B8B0] focus:bg-white"/></label>
        <label className="block"><span className="mb-2 block text-[12px] font-semibold text-[#29465D]">Confirm password</span><input autoComplete="new-password" type="password" minLength={8} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)} className="focus-ring w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3.5 text-[13px] text-[#102B45] outline-none focus:border-[#16B8B0] focus:bg-white"/></label>
        {error&&<p role="alert" className="rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[12px] text-[#B42318]">{error}</p>}
        <button disabled={pending} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#102B45] px-4 py-4 text-[13px] font-semibold text-white transition hover:bg-[#174363] disabled:cursor-not-allowed disabled:opacity-60">{pending?'Saving password…':'Set password'}{!pending&&<span className="text-[#35D5C2]">→</span>}</button>
      </form>}
      <p className="mt-6 text-center text-[12px] text-[#7B91A1]"><Link href="/auth/forgot-password" className="font-semibold text-[#087F86] hover:underline">Request a new setup link</Link></p>
    </section><div className="border-t border-[#E8EEF2] pt-5"><SoftflixSignature/></div>
  </main>;
}
