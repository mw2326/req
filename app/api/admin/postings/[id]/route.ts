import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getUser } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/admin';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { status } = await req.json();
  if (status !== 'visible' && status !== 'removed') {
    return NextResponse.json({ error: 'status must be "visible" or "removed".' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('postings').update({ status }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
