import { auth } from '@/lib/auth/server';
import { rejectLearnerProgression, LearnerProgressionError } from '@/application/learner/progression-service';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request,context:{params:Promise<{organisationId:string;requestId:string}>}) {
 const {data}=await auth.getSession(); if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId,requestId}=await context.params; if(!uuidPattern.test(organisationId)||!uuidPattern.test(requestId))return Response.json({error:'Invalid organisation or request ID'},{status:400});
 let body:unknown={}; try{body=await request.json();}catch{}
 const value=body&&typeof body==='object'?body as Record<string,unknown>:{};
 if(typeof value.reason!=='string')return Response.json({error:'A decision reason is required'},{status:400});
 try{return Response.json(await rejectLearnerProgression(data.user.id,organisationId,requestId,value.reason as string));}
 catch(error){if(error instanceof LearnerProgressionError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to complete progression decision'},{status:500});}
}
