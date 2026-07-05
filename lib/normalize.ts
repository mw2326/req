import { SupabaseClient } from '@supabase/supabase-js';

export async function resolveCompany(supabase: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('resolve_company', { input: name });
  if (error) throw error;
  return data as string;
}

export async function resolveSkill(supabase: SupabaseClient, skill: string): Promise<string> {
  const { data, error } = await supabase.rpc('resolve_skill', { input: skill });
  if (error) throw error;
  return data as string;
}
