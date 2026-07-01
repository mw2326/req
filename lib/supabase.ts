import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Add them to .env.local (see README).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Posting = {
  id: string;
  company: string;
  role: string;
  skills: string[];
  raw_text: string;
  created_at: string;
};
