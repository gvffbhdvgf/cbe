'use client';

import { FormEvent, useState } from 'react';
import type { ActorRole, OrganisationRole } from '@/application/organisation/membership-policy';

type Member = { id: string; userId: string; name: string; email: string; role: string; startsAt: string; endsAt: string | null };
const labels: Record<OrganisationRole, string> = { organisation_admin: 'Organisation administrator', school_admin: 'School administrator', teacher: 'Teacher', assessor: 'Assessor', viewer: 'Viewer' };

export function MembershipManager({ organisationId, actorRole, initialMembers }: { organisationId: string; actorRole: ActorRole; initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganisationRole>(actorRole === 'platform_admin' ? 'organisation_admin' : actorRole === 'organisation_admin' ? 'school_admin' : 'teacher');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const assignable: OrganisationRole[] = actorRole === 'platform_admin'
    ? ['organisation_admin', 'school_admin', 'teacher', 'assessor', 'viewer']
    : actorRole === 'organisation_admin'
      ? ['school_admin', 'teacher', 'assessor', 'viewer']
      : ['teacher', 'assessor', 'viewer'];

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/members`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add member');
      const refresh = await fetch(`/api/organisations/${organisationId}/members`);
      const latest = await refresh.json();
      if (refresh.ok) setMembers(latest.members);
      setEmail(''); setNotice(`${result.member.name} now has ${labels[role].toLowerCase()} access.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add member'); }
    finally { setPending(false); }
  }

  async function revokeMember(member: Member) {
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organisations/${organisationId}/members/${member.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to revoke membership');
      setMembers(current => current.filter(item => item.id !== member.id));
      setNotice(`Access for ${member.name} has been revoked.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to revoke membership'); }
    finally { setPending(false); }
  }

  return <div className="mt-9 space-y-6">
    <section className="rounded-[20px] border border-[#DDEBEA] bg-white p-6 sm:p-8">
      <p className="eyebrow">Add a team member</p>
      <h2 className="mt-2 text-[18px] font-semibold text-[#18364E]">Grant organisation access</h2>
      <p className="mt-2 text-[12px] leading-6 text-[#718697]">The person must already have a verified Sentinel account. This step grants organisation access; it does not create an account or send an invitation email.</p>
      <form onSubmit={addMember} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-[11px] font-semibold text-[#29465D]">Account email<input required type="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="person@institution.org" className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]"/></label>
        <label className="text-[11px] font-semibold text-[#29465D]">Role<select value={role} onChange={event=>setRole(event.target.value as OrganisationRole)} className="mt-2 w-full rounded-xl border border-[#DCE6EC] bg-[#FAFCFD] px-4 py-3 text-[13px] font-normal outline-none focus:border-[#16B8B0]">{assignable.map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>
        <button type="submit" disabled={pending || !email.trim()} className="rounded-xl bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-60">{pending ? 'Saving…' : 'Grant access'}</button>
      </form>
    </section>

    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="flex items-center justify-between border-b border-[#EAF0F4] px-6 py-5"><div><h2 className="text-[13px] font-semibold text-[#29465D]">Active members</h2><p className="mt-1 text-[10px] text-[#91A3B0]">Only verified, active memberships are listed</p></div><span className="rounded-full bg-[#F3F7F9] px-3 py-1.5 text-[10px] font-semibold text-[#7B91A1]">{members.length} members</span></div>
      {members.length ? <div className="divide-y divide-[#EDF2F5]">{members.map(member=><div key={member.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"><div><p className="text-[12px] font-semibold text-[#18364E]">{member.name}</p><p className="mt-1 text-[11px] text-[#7A8F9E]">{member.email}</p><p className="mt-1 text-[10px] font-semibold text-[#087F86]">{labels[member.role as OrganisationRole] ?? member.role}</p></div><button type="button" disabled={pending} onClick={()=>revokeMember(member)} className="rounded-lg border border-[#F0D8D5] px-3 py-2 text-[10px] font-semibold text-[#A33C34] hover:bg-[#FFF5F3] disabled:opacity-50">Revoke access</button></div>)}</div> : <div className="px-6 py-12 text-center text-[12px] text-[#8195A4]">No active members were found.</div>}
    </section>
    {error && <p role="alert" className="rounded-xl border border-[#F6D6D2] bg-[#FFF5F3] p-3 text-[11px] text-[#B42318]">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-[#DDEBEA] bg-[#F2F8F8] p-3 text-[11px] text-[#087F86]">{notice}</p>}
  </div>;
}
