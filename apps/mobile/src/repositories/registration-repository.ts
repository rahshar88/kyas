import {
  isAccountStatus,
  type AccountStatus,
  type IndiaBackground,
  type StudyDetails,
  type SydneyLocation,
} from '@kyascene/domain';

import { PROVIDER_NOT_LISTED } from '@kyascene/domain';
import { getSupabase } from '@/services/supabase';

import { guard } from './errors';

/**
 * Reads and writes the signed-in student's own registration rows.
 *
 * Everything here is safe under Row Level Security — a student may only ever touch their own
 * rows — which is why it goes direct from the client rather than through an Edge Function
 * (§12.1). Anything privileged (invite redemption, submitting for review) does not live here.
 */
export interface ProfileSummary {
  userId: string;
  displayName: string | null;
  status: AccountStatus;
}

export interface ReferenceOption {
  code: string;
  name: string;
}

export interface RegistrationRepository {
  ensureProfile(userId: string): Promise<ProfileSummary>;
  getStatus(userId: string): Promise<AccountStatus | null>;
  hasRedeemedInvite(userId: string): Promise<boolean>;
  saveStudyDetails(userId: string, details: StudyDetails): Promise<void>;
  saveSydneyLocation(userId: string, location: SydneyLocation): Promise<void>;
  saveIndiaBackground(userId: string, background: IndiaBackground): Promise<void>;
  listIndiaStates(): Promise<ReferenceOption[]>;
  listEducationProviders(): Promise<ReferenceOption[]>;
}

function readStatus(value: string): AccountStatus {
  // An unrecognised status means the server is ahead of this build. Treating it as
  // 'onboarding' would wrongly let someone continue, so the safe reading is the most
  // restrictive one the client understands.
  return isAccountStatus(value) ? value : 'pending_review';
}

export const registrationRepository: RegistrationRepository = {
  /**
   * §12.4: idempotent. Called after every successful verification, and a second call for an
   * existing account must not fail or reset anything — hence upsert with `ignoreDuplicates`
   * rather than insert.
   */
  async ensureProfile(userId: string): Promise<ProfileSummary> {
    return guard(async () => {
      const supabase = getSupabase();

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (upsertError) throw upsertError;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, status')
        .eq('user_id', userId)
        .single();
      if (error) throw error;

      return {
        userId: data.user_id,
        displayName: data.display_name,
        status: readStatus(data.status),
      };
    });
  },

  /**
   * §8.2: "Route guards must be derived from server status, not only client state." This is
   * that server status.
   */
  async getStatus(userId: string): Promise<AccountStatus | null> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;

      return data === null ? null : readStatus(data.status);
    });
  },

  /**
   * §S04 gates registration on a redeemed invitation, so "where do I resume?" cannot be
   * answered by status alone — every status from `invited` to `onboarding` looks the same
   * until you know whether a code was used.
   *
   * A student may read their own redemption row (and only their own), so this is a direct
   * query rather than another Edge Function call.
   */
  async hasRedeemedInvite(userId: string): Promise<boolean> {
    return guard(async () => {
      const { count, error } = await getSupabase()
        .from('invite_redemptions')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      return (count ?? 0) > 0;
    });
  },

  async saveStudyDetails(userId: string, details: StudyDetails): Promise<void> {
    await guard(async () => {
      const usesNotListed = details.provider === PROVIDER_NOT_LISTED;

      const { error } = await getSupabase()
        .from('student_profiles')
        .upsert(
          {
            user_id: userId,
            // §S06's "Not listed" path stores free text and no catalogue code, because the
            // column has a foreign key onto education_providers.
            provider: usesNotListed ? null : details.provider,
            provider_other: usesNotListed ? (details.providerOther ?? null) : null,
            campus: details.campus ?? null,
            course: details.course,
            study_level: details.studyLevel,
            intake_month: details.intakeMonth,
            intake_year: details.intakeYear,
            completion_month: details.completionMonth,
            completion_year: details.completionYear,
            student_email: details.studentEmail ?? null,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    }, 'VALIDATION_FAILED');
  },

  async saveSydneyLocation(userId: string, location: SydneyLocation): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase()
        .from('student_profiles')
        .upsert(
          {
            user_id: userId,
            suburb: location.suburb,
            postcode: location.postcode === '' ? null : (location.postcode ?? null),
            arrival_status: location.arrivalStatus,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    }, 'VALIDATION_FAILED');
  },

  async saveIndiaBackground(userId: string, background: IndiaBackground): Promise<void> {
    await guard(async () => {
      const { error } = await getSupabase()
        .from('student_profiles')
        .upsert(
          {
            user_id: userId,
            india_state_code: background.stateCode,
            hometown: background.hometown === '' ? null : (background.hometown ?? null),
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    }, 'VALIDATION_FAILED');
  },

  async listIndiaStates(): Promise<ReferenceOption[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('india_states')
        .select('code, name')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;

      return data.map((row) => ({ code: row.code, name: row.name }));
    });
  },

  async listEducationProviders(): Promise<ReferenceOption[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('education_providers')
        .select('code, name')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;

      return data.map((row) => ({ code: row.code, name: row.name }));
    });
  },
};
