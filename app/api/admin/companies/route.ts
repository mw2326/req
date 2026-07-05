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

  const [{ data: companies, error: companiesError }, { data: postings, error: postingsError }] = await Promise.all([
    supabase.from('companies').select('canonical_name'),
    supabase.from('postings').select('company'),
  ]);

  if (companiesError) return NextResponse.json({ error: companiesError.message }, { status: 500 });
  if (postingsError) return NextResponse.json({ error: postingsError.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const p of postings ?? []) {
    counts.set(p.company, (counts.get(p.company) ?? 0) + 1);
  }

  const withCounts = (companies ?? []).map((c: any) => ({
    canonicalName: c.canonical_name,
    count: counts.get(c.canonical_name) ?? 0,
  }));

  withCounts.sort((a, b) => b.count - a.count);

  return NextResponse.json(withCounts);
}
