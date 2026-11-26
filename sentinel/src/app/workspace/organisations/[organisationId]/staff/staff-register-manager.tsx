'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

type Engagement = { id: string; engagementType: string; jobTitle: string; startsOn: string; endsOn: string | null; status: string };
type StaffProfile = {
  id: string; personId: string; staffReference: string; staffCategory: string; status: string; userId: string | null; linkedEmail: string | null;
  legalFirstName: string; legalMiddleName: string | null; legalLastName: string; preferredName: string | null; engagements: Engagement[];
};
type TeacherAccount = { userId: string; name: string; email: string };
type PersonMatch = { id: string; legalFirstName: string; legalMiddleName: string | null; legalLastName: string; preferredName: string | null };
type Summary = { organisation: { id: string; name: string; timeZone: string }; staff: StaffProfile[]; eligibleTeacherAccounts: TeacherAccount[]; personMatches: PersonMatch[] };

const field = 'mt-1 w-full rounded-xl border border-[#DCE7EC] bg-white px-3 py-2.5 text-[12px] text-[#29465D] outline-none focus:border-[#73CFC2]';
const label = 'block text-[10px] font-semibold uppercase tracking-[.1em] text-[#7890A0]';
const todayInKenya = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
const nextDate = (date: string) => { const value = new Date(date + 'T00:00:00Z'); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };
const personName = (person: Pick<PersonMatch, 'legalFirstName'|'legalMiddleName'|'legalLastName'|'preferredName'>) =>
  [person.preferredName || person.legalFirstName, person.legalMiddleName, person.legalLastName].filter(Boolean).join(' ');

export function StaffRegisterManager({ organisationId, initialSummary }: { organisationId: string; initialSummary: Summary }) {
  const router = useRouter();
  const [summary,setSummary]=useState(initialSummary);
  const [personSearch,setPersonSearch]=useState('');
  const [personSearchPerformed,setPersonSearchPerformed]=useState(false);
  const [selectedPerson,setSelectedPerson]=useState<PersonMatch|null>(null);
  const [firstName,setFirstName]=useState('');
  const [middleName,setMiddleName]=useState('');
  const [lastName,setLastName]=useState('');
  const [preferredName,setPreferredName]=useState('');
  const [staffReference,setStaffReference]=useState('');
  const [staffCategory,setStaffCategory]=useState('teacher');
  const [jobTitle,setJobTitle]=useState('Teacher');
  const [engagementType,setEngagementType]=useState('permanent');
  const [startsOn,setStartsOn]=useState(todayInKenya());
  const [endsOn,setEndsOn]=useState('');
  const [confirmDistinctPerson,setConfirmDistinctPerson]=useState(false);
  const [linkUserIds,setLinkUserIds]=useState<Record<string,string>>({});
  const [invitationEmails,setInvitationEmails]=useState<Record<string,string>>({});
  const [invitationLinks,setInvitationLinks]=useState<Record<string,string>>({});
  const [endDates,setEndDates]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function reload(search=personSearch) {
    const response=await fetch('/api/organisations/'+organisationId+'/staff?personSearch='+encodeURIComponent(search));
    const payload=await response.json();
    if(!response.ok) throw new Error(payload.error||'Unable to refresh the staff register.');
    setSummary(payload as Summary);
  }

  async function searchPeople() {
    setBusy('search'); setError(''); setMessage('');
    try { await reload(personSearch); setPersonSearchPerformed(true); }
    catch(cause) { setError(cause instanceof Error?cause.message:'Unable to search existing people.'); }
    finally { setBusy(''); }
  }

  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('create'); setError(''); setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/staff',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        personId:selectedPerson?.id??null,
        firstName:selectedPerson?null:firstName,
        middleName:selectedPerson?null:middleName,
        lastName:selectedPerson?null:lastName,
        preferredName:selectedPerson?null:preferredName,
        staffReference,staffCategory,jobTitle,engagementType,startsOn,endsOn:endsOn||null,
        confirmDistinctPerson:selectedPerson?false:confirmDistinctPerson,
      })});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to create staff profile.');
      setSelectedPerson(null); setFirstName(''); setMiddleName(''); setLastName(''); setPreferredName('');
      setStaffReference(''); setStaffCategory('teacher'); setJobTitle('Teacher'); setEngagementType('permanent');
      setStartsOn(todayInKenya()); setEndsOn(''); setConfirmDistinctPerson(false); setPersonSearch(''); setPersonSearchPerformed(false);
      await reload('');
      setMessage('Staff profile and initial engagement created. Link a verified Teacher account when it is available.');
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to create staff profile.'); }
    finally { setBusy(''); }
  }

  async function linkAccount(profileId:string) {
    const userId=linkUserIds[profileId];
    if(!userId) { setError('Choose a verified Teacher account to link.'); return; }
    setBusy('link:'+profileId); setError(''); setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/staff/'+profileId+'/link-account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to link Teacher account.');
      await reload('');
      setMessage('Verified Teacher account linked to the staff profile.');
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to link Teacher account.'); }
    finally { setBusy(''); }
  }

  async function inviteStaffAccount(profile:StaffProfile, createAccount:boolean) {
    const email=(invitationEmails[profile.id]??'').trim().toLowerCase();
    if(!email) { setError('Enter the staff member email address first.'); return; }
    setBusy('invite:'+profile.id); setError(''); setMessage('');
    try {
      if(createAccount) {
        const temporaryPassword=crypto.randomUUID()+crypto.randomUUID();
        const created=await authClient.admin.createUser({
          email,password:temporaryPassword,name:personName(profile),role:'user',
        });
        if(created.error) throw new Error(created.error.message||'Could not provision the staff account.');
      }
      const verification=await authClient.emailOtp.sendVerificationOtp({email,type:'email-verification'});
      if(verification.error) throw new Error(verification.error.message||'Could not send the verification code.');
      const audit=await fetch('/api/organisations/'+organisationId+'/staff',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'record-invitation',staffProfileId:profile.id,email}),
      });
      const auditPayload=await audit.json();
      if(!audit.ok) throw new Error(auditPayload.error||'The verification code was sent but its audit record could not be saved.');
      setInvitationLinks(current=>({...current,[profile.id]:window.location.origin+'/auth/verify-email'}));
      setMessage(createAccount
        ? 'Staff account created and verification code sent. Share the setup page with the staff member; never share the temporary password.'
        : 'Verification code sent to the existing account. Share the setup page with the staff member.');
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Could not create the staff account invitation.');
    } finally { setBusy(''); }
  }

  async function copyStaffSetupLink(profileId:string) {
    const link=invitationLinks[profileId];
    if(!link) return;
    try { await navigator.clipboard.writeText(link); setMessage('Staff setup link copied.'); }
    catch { setError('Clipboard access was unavailable. Copy this link manually: '+link); }
  }

  async function endEngagement(engagementId:string) {
    const date=endDates[engagementId];
    if(!date) { setError('Choose an engagement end date.'); return; }
    setBusy('end:'+engagementId); setError(''); setMessage('');
    try {
      const response=await fetch('/api/organisations/'+organisationId+'/staff/engagements/'+engagementId,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({endsOn:date})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to update engagement.');
      await reload('');
      setMessage('Staff engagement end date recorded.');
      router.refresh();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to update engagement.'); }
    finally { setBusy(''); }
  }

  return <div className="mt-8 space-y-6">
    <section className="rounded-[20px] border border-[#DCE8EC] bg-white p-5 sm:p-7">
      <p className="eyebrow">Canonical workforce records</p>
      <h2 className="mt-2 text-[20px] font-semibold tracking-[-.03em] text-[#102B45]">Create a staff profile and engagement</h2>
      <p className="mt-2 max-w-[780px] text-[11px] leading-6 text-[#718697]">A staff profile is linked to a canonical Person record. Employment or contract details are held in a separate effective-dated engagement. No login credentials, date of birth or qualifications are collected here.</p>

      <div className="mt-6 rounded-2xl border border-[#E5EDF1] bg-[#FBFDFD] p-4">
        <label className={label}>Find an existing person before creating a new record</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={personSearch} onChange={e=>{setPersonSearch(e.target.value);setPersonSearchPerformed(false);}} placeholder="Search legal or preferred name" className={field}/><button type="button" disabled={busy!==''||personSearch.trim().length<2} onClick={()=>void searchPeople()} className="shrink-0 rounded-full border border-[#BFD8D8] px-4 py-2 text-[10px] font-semibold text-[#087F86] disabled:opacity-40">{busy==='search'?'Searching…':'Search people'}</button></div>
        {selectedPerson&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#EAF7F5] p-3"><p className="text-[11px] font-semibold text-[#245A5B]">Using existing person: {personName(selectedPerson)}</p><button type="button" onClick={()=>setSelectedPerson(null)} className="text-[10px] font-semibold text-[#087F86]">Clear selection</button></div>}
        {!selectedPerson&&summary.personMatches.length>0&&<div className="mt-3 space-y-2">{summary.personMatches.map(person=><button key={person.id} type="button" onClick={()=>setSelectedPerson(person)} className="flex w-full items-center justify-between rounded-xl border border-[#E5EDF1] bg-white px-3 py-2 text-left hover:border-[#8CCFC7]"><span className="text-[11px] font-medium text-[#29465D]">{personName(person)}</span><span className="text-[10px] font-semibold text-[#087F86]">Use this person</span></button>)}</div>}
        {!selectedPerson&&personSearchPerformed&&personSearch.trim().length>=2&&summary.personMatches.length===0&&<p className="mt-3 text-[10px] text-[#718697]">No matching unlinked person records found. If this is a new person, complete the details below and confirm that you checked for duplicates.</p>}
      </div>

      <form onSubmit={create} className="mt-5 grid gap-4 sm:grid-cols-2">
        {!selectedPerson&&<><label className={label}>Legal first name<input required value={firstName} onChange={e=>setFirstName(e.target.value)} className={field} maxLength={120}/></label><label className={label}>Legal middle name (optional)<input value={middleName} onChange={e=>setMiddleName(e.target.value)} className={field} maxLength={120}/></label><label className={label}>Legal last name<input required value={lastName} onChange={e=>setLastName(e.target.value)} className={field} maxLength={120}/></label><label className={label}>Preferred name (optional)<input value={preferredName} onChange={e=>setPreferredName(e.target.value)} className={field} maxLength={120}/></label><label className="sm:col-span-2 flex items-start gap-2 text-[10px] leading-5 text-[#718697]"><input type="checkbox" checked={confirmDistinctPerson} onChange={e=>setConfirmDistinctPerson(e.target.checked)} className="mt-1"/>I checked the institution&apos;s person register and confirm this is a distinct person record.</label></>}
        <label className={label}>Staff reference<input required value={staffReference} onChange={e=>setStaffReference(e.target.value)} className={field} placeholder="e.g. TCH-001" maxLength={48}/></label>
        <label className={label}>Staff category<select value={staffCategory} onChange={e=>setStaffCategory(e.target.value)} className={field}><option value="teacher">Teacher</option><option value="school_leader">School leader</option><option value="administrator">Administrator</option><option value="support_staff">Support staff</option><option value="specialist">Specialist</option><option value="other">Other</option></select></label>
        <label className={label}>Job title<input required value={jobTitle} onChange={e=>setJobTitle(e.target.value)} className={field} maxLength={120}/></label>
        <label className={label}>Engagement type<select value={engagementType} onChange={e=>setEngagementType(e.target.value)} className={field}><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="casual">Casual</option><option value="volunteer">Volunteer</option><option value="internship">Internship</option><option value="other">Other</option></select></label>
        <label className={label}>Engagement starts on<input type="date" required value={startsOn} onChange={e=>setStartsOn(e.target.value)} className={field}/></label>
        <label className={label}>Engagement ends on (exclusive, optional)<input type="date" min={nextDate(startsOn)} value={endsOn} onChange={e=>setEndsOn(e.target.value)} className={field}/></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={busy!==''||(!selectedPerson&&!confirmDistinctPerson)} className="rounded-full bg-[#102B45] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40">{busy==='create'?'Saving staff profile…':'Create staff profile'}</button>{selectedPerson&&<span className="text-[10px] text-[#718697]">The selected Person record will be reused.</span>}</div>
      </form>
      {error&&<p role="alert" className="mt-4 text-[11px] text-[#A43D34]">{error}</p>}
      {message&&<p role="status" className="mt-4 text-[11px] text-[#087F86]">{message}</p>}
    </section>

    <section className="overflow-hidden rounded-[20px] border border-[#E1EAF0] bg-white">
      <div className="border-b border-[#E8EEF2] px-5 py-4"><h2 className="text-[14px] font-semibold text-[#18364E]">Staff register</h2><p className="mt-1 text-[11px] text-[#8498A7]">{summary.staff.length} staff profiles · {summary.eligibleTeacherAccounts.length} verified Teacher accounts available to link</p></div>
      {summary.staff.length===0?<p className="px-5 py-9 text-[12px] text-[#8498A7]">No staff profiles have been created for this institution.</p>:<div className="divide-y divide-[#E8EEF2]">{summary.staff.map(profile=>{
        const name=personName(profile);
        const activeEngagement=profile.engagements.find(e=>e.status==='active'||e.status==='planned')??profile.engagements[profile.engagements.length-1];
        return <article key={profile.id} className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[13px] font-semibold text-[#29465D]">{name}</p><p className="mt-1 text-[10px] text-[#718697]">{profile.staffReference} · {profile.staffCategory.replaceAll('_',' ')} · {profile.status}</p>{activeEngagement&&<p className="mt-1 text-[10px] text-[#8A9CAB]">{activeEngagement.jobTitle} · {activeEngagement.engagementType} · {activeEngagement.startsOn} to {activeEngagement.endsOn??'open-ended'} · {activeEngagement.status}</p>}</div>{profile.linkedEmail?<span className="rounded-full bg-[#EAF7F5] px-3 py-1.5 text-[10px] font-semibold text-[#087F86]">Linked · {profile.linkedEmail}</span>:profile.staffCategory==='teacher'?<span className="rounded-full bg-[#FFF7E8] px-3 py-1.5 text-[10px] font-semibold text-[#93641B]">Account not linked</span>:<span className="rounded-full bg-[#F2F5F7] px-3 py-1.5 text-[10px] font-semibold text-[#718697]">No account linked</span>}</div>
          {!profile.userId&&<div className="space-y-3 rounded-xl bg-[#F8FBFC] p-3">
            <p className="text-[10px] leading-5 text-[#718697]">Invite this staff member using their own email address. Sentinel creates the account with a discarded temporary password and sends the existing Neon Auth verification code. They choose their own password.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className={label+' flex-1'}>Staff member email<input type="email" required value={invitationEmails[profile.id]??''} onChange={e=>setInvitationEmails(current=>({...current,[profile.id]:e.target.value}))} placeholder="name@school.org" className={field}/></label>
              <button type="button" disabled={busy!==''||Boolean(invitationLinks[profile.id])} onClick={()=>void inviteStaffAccount(profile,true)} className="rounded-full bg-[#087F86] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40">{busy==='invite:'+profile.id?'Sending…':'Create account & send code'}</button>
              <button type="button" disabled={busy!==''||Boolean(invitationLinks[profile.id])} onClick={()=>void inviteStaffAccount(profile,false)} className="rounded-full border border-[#BFD8D8] px-4 py-2.5 text-[10px] font-semibold text-[#087F86] disabled:opacity-40">Send code to existing account</button>
            </div>
            {invitationLinks[profile.id]&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"><p className="text-[10px] text-[#627B8E]">After verification, grant the appropriate organisation role under Members. Teacher accounts can then be linked below.</p><button type="button" onClick={()=>void copyStaffSetupLink(profile.id)} className="text-[10px] font-semibold text-[#087F86]">Copy setup link</button></div>}
          </div>}
          {!profile.userId&&profile.staffCategory==='teacher'&&<div className="flex flex-col gap-2 rounded-xl bg-[#F8FBFC] p-3 sm:flex-row sm:items-end"><label className={label+' flex-1'}>Verified Teacher account<select value={linkUserIds[profile.id]??''} onChange={e=>setLinkUserIds(current=>({...current,[profile.id]:e.target.value}))} className={field}><option value="">Choose account</option>{summary.eligibleTeacherAccounts.map(account=><option key={account.userId} value={account.userId}>{account.name} · {account.email}</option>)}</select></label><button type="button" disabled={busy!==''||summary.eligibleTeacherAccounts.length===0} onClick={()=>void linkAccount(profile.id)} className="rounded-full border border-[#BFD8D8] px-4 py-2.5 text-[10px] font-semibold text-[#087F86] disabled:opacity-40">{busy==='link:'+profile.id?'Linking…':'Link account'}</button></div>}
          {profile.engagements.map(engagement=><div key={engagement.id} className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#E8EEF2] p-3"><div><p className="text-[10px] font-semibold text-[#526F83]">{engagement.jobTitle} · {engagement.engagementType} · {engagement.status}</p><p className="mt-1 text-[10px] text-[#8A9CAB]">{engagement.startsOn} to {engagement.endsOn??'open-ended'}</p></div>{engagement.status!=='ended'&&<div className="flex items-end gap-2"><label className={label}>Set end date<input type="date" min={nextDate(engagement.startsOn)} value={endDates[engagement.id]??''} onChange={e=>setEndDates(current=>({...current,[engagement.id]:e.target.value}))} className={field}/></label><button type="button" disabled={busy!==''} onClick={()=>void endEngagement(engagement.id)} className="rounded-full border border-[#E7D4D0] px-3 py-2.5 text-[10px] font-semibold text-[#A43D34] disabled:opacity-40">{busy==='end:'+engagement.id?'Saving…':'Set end date'}</button></div>}</div>)}
        </article>;
      })}</div>}
      {summary.eligibleTeacherAccounts.length===0&&<div className="border-t border-[#E8EEF2] bg-[#FBFDFD] px-5 py-4 text-[10px] leading-5 text-[#718697]">No verified active Teacher memberships are available to link. Add the account under Institution members and complete email verification first; this register does not create login credentials.</div>}
    </section>
  </div>;
}
