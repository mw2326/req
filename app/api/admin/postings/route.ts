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

  const [{ data: postings, error: postingsError }, { data: reports, error: reportsError }] = await Promise.all([
    supabase.from('postings').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('reports').select('posting_id, reason, created_at').order('created_at', { ascending: false }),
  ]);

  if (postingsError) return NextResponse.json({ error: postingsError.message }, { status: 500 });
  if (reportsError) return NextResponse.json({ error: reportsError.message }, { status: 500 });

  const reportsByPosting = new Map<string, { count: number; reasons: string[] }>();
  for (const r of reports ?? []) {
    const entry = reportsByPosting.get(r.posting_id) ?? { count: 0, reasons: [] };
    entry.count += 1;
    if (r.reason) entry.reasons.push(r.reason);
    reportsByPosting.set(r.posting_id, entry);
  }

  const withReports = (postings ?? []).map((p: any) => ({
    ...p,
    reportCount: reportsByPosting.get(p.id)?.count ?? 0,
    reportReasons: reportsByPosting.get(p.id)?.reasons ?? [],
  }));

  withReports.sort((a, b) => b.reportCount - a.reportCount);

  return NextResponse.json(withReports);
}
