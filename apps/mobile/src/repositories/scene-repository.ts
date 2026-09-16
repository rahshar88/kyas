import { getSupabase } from '@/services/supabase';

import { guard } from './errors';

/**
 * The Scene — the public directory (ADR-0007).
 *
 * The only repository that works without a session. The publishable key alone reaches these
 * two tables: Row Level Security serves active rows to the `anon` role and nothing else, and
 * the database refuses writes from any client session, signed in or not. So there is no
 * userId parameter anywhere in this file, and there never should be — a person-shaped
 * argument appearing here would mean the public side has started touching people, which
 * ADR-0007 forbids.
 */
export interface SceneCategory {
  code: string;
  label: string;
}

export interface ScenePlace {
  id: string;
  name: string;
  categoryCode: string;
  suburb: string;
  stateCode: string;
  address: string | null;
  url: string | null;
  phone: string | null;
  description: string | null;
}

export interface SceneRepository {
  listCategories(): Promise<SceneCategory[]>;
  listPlaces(): Promise<ScenePlace[]>;
  getPlace(id: string): Promise<ScenePlace | null>;
}

const toPlace = (row: {
  id: string;
  name: string;
  category_code: string;
  suburb: string;
  state_code: string;
  address: string | null;
  url: string | null;
  phone: string | null;
  description: string | null;
}): ScenePlace => ({
  id: row.id,
  name: row.name,
  categoryCode: row.category_code,
  suburb: row.suburb,
  stateCode: row.state_code,
  address: row.address,
  url: row.url,
  phone: row.phone,
  description: row.description,
});

export const sceneRepository: SceneRepository = {
  async listCategories(): Promise<SceneCategory[]> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('place_categories')
        .select('code, label')
        .order('sort_order')
        .order('label');
      if (error) throw error;
      return data ?? [];
    });
  },

  async listPlaces(): Promise<ScenePlace[]> {
    return guard(async () => {
      // RLS already hides inactive rows; no `.eq('active', true)` here, because a filter the
      // client applies is a filter the client can forget. The policy is the truth.
      const { data, error } = await getSupabase()
        .from('places')
        .select('id, name, category_code, suburb, state_code, address, url, phone, description')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toPlace);
    });
  },

  async getPlace(id: string): Promise<ScenePlace | null> {
    return guard(async () => {
      const { data, error } = await getSupabase()
        .from('places')
        .select('id, name, category_code, suburb, state_code, address, url, phone, description')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data === null ? null : toPlace(data);
    });
  },
};
