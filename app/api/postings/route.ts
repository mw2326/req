import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getUser } from '@/lib/supabase-server';
import { checkRateLimit, getPostLimiter } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const company = req.nextUrl.searchParams.get('company')?.trim();

    let query = supabase
      .from('postings')
      .select('*')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(200);

    if (company) {
      query = query.ilike('company', `%${company}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data ?? [];

    if (q) {
      const lower = q.toLowerCase();
      results = results.filter(
        (p: any) =>
          p.company.toLowerCase().includes(lower) ||
          p.role.toLowerCase().includes(lower) ||
          (p.skills as string[]).some((s) => s.toLowerCase().includes(lower))
      );
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to load postings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const { success } = await checkRateLimit(getPostLimiter(), user.id);
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded — try again later.' }, { status: 429 });
    }

    const { company, role, skills, rawText } = await req.json();
    if (!company || !role || !Array.isArray(skills)) {
      return NextResponse.json({ error: 'Missing company, role, or skills.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('postings')
      .insert({ company, role, skills, raw_text: (rawText ?? '').slice(0, 4000), user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to add posting.' }, { status: 500 });
  }
}
