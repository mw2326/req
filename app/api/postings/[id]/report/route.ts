import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

    const { reason } = await req.json().catch(() => ({ reason: undefined }));

    const supabase = getSupabase();
    const { error } = await supabase.from('reports').insert({
      posting_id: params.id,
      reporter_id: user.id,
      reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
    });

    // Unique constraint violation means this user already reported this
    // posting — treat as success, no need to surface an error for that.
    if (error && error.code !== '23505') throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to report posting.' }, { status: 500 });
  }
}
