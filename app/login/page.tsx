'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

const EDU_RE = /\.edu$/i;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const urlError = params.get('error');

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError);

  async function sendMagicLink() {
    setError(null);
    const trimmed = email.trim();
    if (!EDU_RE.test(trimmed)) {
      setError('Please use a .edu email address.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch (err: any) {
      setError(err.message?.includes('.edu') ? err.message : 'Could not send magic link — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = getBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen bg-ink text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 42%, rgba(255,201,60,0.08), transparent 45%), linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 42px 42px, 42px 42px',
        }}
      />
      <div className="w-full max-w-[380px] relative">
        <div className="font-display font-bold text-[26px] tracking-tight mb-1.5 text-center">
          RE<span className="text-amber">Q</span>
        </div>
        <div className="font-mono text-xs text-ink2 text-center mb-8">
          {'// for verified students — .edu email required'}
        </div>

        <div className="border border-hairline rounded-lg bg-surface p-5">
          {sent ? (
            <div className="text-center text-[13.5px] text-ink2 leading-relaxed">
              Check <span className="text-white">{email.trim()}</span> for a sign-in link.
            </div>
          ) : (
            <>
              <label className="font-mono text-[11px] uppercase text-ink2 tracking-wide mb-2 block">
                School email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
                placeholder="you@university.edu"
                className="w-full bg-surface2 border border-hairline rounded font-mono text-[13px] px-3.5 py-2.5 text-white placeholder:text-[#565d6b] focus:outline-none focus:ring-2 focus:ring-amber mb-3"
              />
              <button
                onClick={sendMagicLink}
                disabled={loading}
                className="w-full font-mono text-[12.5px] uppercase tracking-wide bg-amber text-[#14161b] font-semibold px-6 py-2.5 rounded disabled:opacity-40"
              >
                Send magic link
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-hairline flex-1" />
                <span className="font-mono text-[10.5px] text-ink2">or</span>
                <div className="h-px bg-hairline flex-1" />
              </div>

              <button
                onClick={signInWithGoogle}
                className="w-full font-mono text-[12.5px] uppercase tracking-wide border border-hairline px-6 py-2.5 rounded hover:border-ink2 flex items-center justify-center gap-2.5"
              >
                <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
                  />
                </svg>
                Continue with Google
              </button>
              <div className="font-mono text-[10.5px] text-ink2 mt-2 text-center">
                Google sign-in only works with a .edu Google account.
              </div>
            </>
          )}

          {error && (
            <div className="mt-3.5 font-mono text-[12px] text-coral border border-coral/40 rounded px-4 py-2.5">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
