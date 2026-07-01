import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const company = req.nextUrl.searchParams.get('company')?.trim();

    let query = supabase.from('postings').select('*').order('created_at', { ascending: false }).limit(200);

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
    const { company, role, skills, rawText } = await req.json();
    if (!company || !role || !Array.isArray(skills)) {
      return NextResponse.json({ error: 'Missing company, role, or skills.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('postings')
      .insert({ company, role, skills, raw_text: (rawText ?? '').slice(0, 4000) })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to add posting.' }, { status: 500 });
  }
}
