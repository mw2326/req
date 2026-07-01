import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('my_skills, dream_company')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    mySkills: data?.my_skills ?? [],
    dreamCompany: data?.dream_company ?? '',
  });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { mySkills, dreamCompany } = await req.json();
  if (!Array.isArray(mySkills) || typeof dreamCompany !== 'string') {
    return NextResponse.json({ error: 'Missing mySkills or dreamCompany.' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from('profiles').upsert({
    user_id: user.id,
    my_skills: mySkills,
    dream_company: dreamCompany,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
