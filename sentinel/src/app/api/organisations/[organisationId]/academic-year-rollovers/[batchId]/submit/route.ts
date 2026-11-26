import { auth } from '@/lib/auth/server';
import { submitAcademicYearRollover, AcademicYearRolloverError } from '@/application/learner/academic-year-rollover-service';

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request:Request,context:{params:Promise<{organisationId:string;batchId:string}>}) {
 const {data}=await auth.getSession();
 if(!data?.user)return Response.json({error:'Authentication required'},{status:401});
 const {organisationId,batchId}=await context.params;
 if(!uuidPattern.test(organisationId)||!uuidPattern.test(batchId))return Response.json({error:'Invalid rollover identifiers'},{status:400});
 try{return Response.json(await submitAcademicYearRollover(data.user.id,organisationId,batchId));}
 catch(error){if(error instanceof AcademicYearRolloverError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'Unable to submit academic-year rollover'},{status:409});}
}
