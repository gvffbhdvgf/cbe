import { sql } from 'drizzle-orm';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

export type GuardianPortalResult = {
  eventTitle: string;
  learningArea: string;
  grade: number;
  academicYear: number;
  percentage: number | string;
  performanceLevel: string | null;
  publishedAt: string | null;
};

export type GuardianPortalLearner = {
  relationship_id: string;
  organisation_id: string;
  organisation_name: string;
  learner_id: string;
  learner_reference: string;
  learner_name: string;
  relationship_type: string;
  grade: number | null;
  academic_year: number | null;
  can_view_progress: boolean;
  can_receive_messages: boolean;
  published_progress: GuardianPortalResult[];
};

export async function getGuardianPortalSummary(actorUserId: string): Promise<GuardianPortalLearner[]> {
  return withAuthenticatedLearnerDb(actorUserId, async tx => {
    const result = await tx.execute(sql`SELECT * FROM sentinel_private.get_guardian_portal_summary()`);
    return result.rows as GuardianPortalLearner[];
  });
}
