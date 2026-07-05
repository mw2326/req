import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getUser } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { from, to } = await req.json();
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
    return NextResponse.json({ error: 'Missing from or to.' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.rpc('admin_merge_skill', { old_name: from, new_name: to.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
