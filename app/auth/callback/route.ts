import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const origin = req.nextUrl.origin;

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const cookieStore = cookies();
      const supabase = createServerClient(url, key, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const message = error.message.includes('.edu')
          ? error.message
          : 'Sign-in failed — only .edu accounts are allowed.';
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
      }
    }
  }

  return NextResponse.redirect(origin);
}
