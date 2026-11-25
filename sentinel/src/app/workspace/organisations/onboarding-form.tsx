'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function OrganisationOnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const externalIdentifier = issuer.trim() || identifier.trim()
        ? { issuer: issuer.trim(), value: identifier.trim() }
        : undefined;
      const response = await fetch('/api/organisations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, externalIdentifier }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to register institution');
      setName('');
      setIssuer('');
      setIdentifier('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register institution');
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
    <label className="text-[11px] font-semibold text-[#29465D] sm:col-span-2">Institution or organisation name
      <input required minLength={2} maxLength={240} value={name} onChange={event=>setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]" placeholder="Enter the registered institution name"/>
    </label>
    <label className="text-[11px] font-semibold text-[#29465D]">Identifier issuer (optional)
      <input value={issuer} onChange={event=>setIssuer(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]" placeholder="e.g. Ministry of Education"/>
    </label>
    <label className="text-[11px] font-semibold text-[#29465D]">External identifier (optional)
      <input value={identifier} onChange={event=>setIdentifier(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]" placeholder="Official source identifier"/>
    </label>
    {error && <p role="alert" className="rounded-xl bg-[#FFF5F3] p-3 text-[11px] text-[#B42318] sm:col-span-2">{error}</p>}
    <div className="sm:col-span-2"><button disabled={pending} className="rounded-xl bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-60">{pending ? 'Registering…' : 'Register institution'}</button></div>
  </form>;
}
