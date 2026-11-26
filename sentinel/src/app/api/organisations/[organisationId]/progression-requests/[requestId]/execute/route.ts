import { auth } from '@/lib/auth/server';
import { executeLearnerProgression, LearnerProgressionError } from '@/application/learner/progression-service';
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(_request:Request,context:{params:Promise<{organisationId:string;requestId:string}>}) {
 const {data}=await auth.getSession(); if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId,requestId}=await context.params; if(!uuidPattern.test(organisationId)||!uuidPattern.test(requestId))return Response.json({error:'Invalid organisation or request ID'},{status:400});
 try{return Response.json(await executeLearnerProgression(data.user.id,organisationId,requestId));}
 catch(error){if(error instanceof LearnerProgressionError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to execute learner progression'},{status:500});}
}
