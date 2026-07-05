import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getUser } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const supabase = getSupabase();

  const [{ data: skills, error: skillsError }, { data: postings, error: postingsError }] = await Promise.all([
    supabase.from('skills').select('canonical_name'),
    supabase.from('postings').select('skills'),
  ]);

  if (skillsError) return NextResponse.json({ error: skillsError.message }, { status: 500 });
  if (postingsError) return NextResponse.json({ error: postingsError.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const p of postings ?? []) {
    for (const s of (p.skills as string[]) ?? []) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }

  const withCounts = (skills ?? []).map((s: any) => ({
    canonicalName: s.canonical_name,
    count: counts.get(s.canonical_name) ?? 0,
  }));

  withCounts.sort((a, b) => b.count - a.count);

  return NextResponse.json(withCounts);
}
